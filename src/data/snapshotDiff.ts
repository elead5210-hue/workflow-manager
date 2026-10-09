// Compare two versions of a workflow and list what was added, removed and
// changed, so earlier iterations of the process can be reviewed side by side.
//
// Nodes and edges are matched by id. Everything here is a pure function of its
// inputs: nothing is read from or written to the database.
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowSnapshot } from '../types'

/** The editable parts of a node that can differ between two versions. */
export type NodeField =
  | 'label'
  | 'type'
  | 'description'
  | 'owner'
  | 'group'
  | 'status'
  | 'position'

/** The editable parts of an edge that can differ between two versions. */
export type EdgeField =
  | 'source'
  | 'target'
  | 'label'
  | 'kind'
  | 'sourceSide'
  | 'targetSide'
  | 'sourceOffset'
  | 'targetOffset'
  | 'routeOffset'

/** One field that differs, with both values already written as text for display. */
export interface FieldChange<F extends string> {
  field: F
  before: string
  after: string
}

/** A node that exists in both versions but is not the same in each. */
export interface NodeChange {
  id: string
  before: WorkflowNode
  after: WorkflowNode
  changes: FieldChange<NodeField>[]
  /** True when the only difference is where the node sits on the canvas. */
  movedOnly: boolean
}

/** An edge that exists in both versions but is not the same in each. */
export interface EdgeChange {
  id: string
  before: WorkflowEdge
  after: WorkflowEdge
  changes: FieldChange<EdgeField>[]
}

/** What happened to one kind of item between the two versions. */
export interface DiffGroup<T, C> {
  /** Only in the newer version, in the order they appear there. */
  added: T[]
  /** Only in the older version, in the order they appear there. */
  removed: T[]
  /** In both versions with different content, in the order of the newer version. */
  changed: C[]
}

/** Everything that differs between an older and a newer version of a workflow. */
export interface WorkflowDiff {
  fromVersion: number
  toVersion: number
  /** Set when the workflow was renamed, otherwise null. */
  nameChange: FieldChange<'name'> | null
  nodes: DiffGroup<WorkflowNode, NodeChange>
  edges: DiffGroup<WorkflowEdge, EdgeChange>
}

/**
 * Compares two workflows. `before` is the older one and `after` the newer one.
 * To compare a saved snapshot with the workflow as it is now, pass
 * `snapshot.workflow` and the current workflow.
 */
export function diffWorkflows(before: Workflow, after: Workflow): WorkflowDiff {
  const nameChanges: FieldChange<'name'>[] = []
  collect(nameChanges, 'name', before.name, after.name)

  return {
    fromVersion: before.version,
    toVersion: after.version,
    nameChange: nameChanges[0] ?? null,
    nodes: diffById(before.nodes, after.nodes, diffNode),
    edges: diffById(before.edges, after.edges, diffEdge),
  }
}

/** Compares two saved snapshots. `before` is the older one and `after` the newer one. */
export function diffSnapshots(before: WorkflowSnapshot, after: WorkflowSnapshot): WorkflowDiff {
  return diffWorkflows(before.workflow, after.workflow)
}

/** True when anything at all differs between the two versions. */
export function hasChanges(diff: WorkflowDiff): boolean {
  return (
    diff.nameChange !== null ||
    diff.nodes.added.length > 0 ||
    diff.nodes.removed.length > 0 ||
    diff.nodes.changed.length > 0 ||
    diff.edges.added.length > 0 ||
    diff.edges.removed.length > 0 ||
    diff.edges.changed.length > 0
  )
}

/**
 * A one-line summary such as "2 nodes added, 1 node moved, 1 edge removed".
 * Nodes whose only change is their canvas position are counted as moved rather
 * than changed, so dragging boxes around does not look like a rewrite.
 */
export function summarizeDiff(diff: WorkflowDiff): string {
  const moved = diff.nodes.changed.filter((change) => change.movedOnly).length
  const edited = diff.nodes.changed.length - moved

  const parts: string[] = []
  if (diff.nameChange) parts.push('workflow renamed')
  pushCount(parts, diff.nodes.added.length, 'node', 'added')
  pushCount(parts, diff.nodes.removed.length, 'node', 'removed')
  pushCount(parts, edited, 'node', 'changed')
  pushCount(parts, moved, 'node', 'moved')
  pushCount(parts, diff.edges.added.length, 'edge', 'added')
  pushCount(parts, diff.edges.removed.length, 'edge', 'removed')
  pushCount(parts, diff.edges.changed.length, 'edge', 'changed')

  if (parts.length === 0) return 'No differences'
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function pushCount(parts: string[], count: number, noun: string, verb: string): void {
  if (count === 0) return
  parts.push(`${count} ${noun}${count === 1 ? '' : 's'} ${verb}`)
}

function diffById<T extends { id: string }, C>(
  before: readonly T[],
  after: readonly T[],
  compare: (before: T, after: T) => C | null,
): DiffGroup<T, C> {
  const beforeById = new Map(before.map((item): [string, T] => [item.id, item]))
  const afterIds = new Set(after.map((item) => item.id))

  const added: T[] = []
  const changed: C[] = []
  for (const item of after) {
    const previous = beforeById.get(item.id)
    if (!previous) {
      added.push(item)
      continue
    }
    const change = compare(previous, item)
    if (change) changed.push(change)
  }

  const removed = before.filter((item) => !afterIds.has(item.id))
  return { added, removed, changed }
}

function diffNode(before: WorkflowNode, after: WorkflowNode): NodeChange | null {
  const changes: FieldChange<NodeField>[] = []
  collect(changes, 'label', before.label, after.label)
  collect(changes, 'type', before.type, after.type)
  collect(changes, 'description', before.description, after.description)
  collect(changes, 'owner', before.ownerId ?? '', after.ownerId ?? '', 'none')
  collect(changes, 'group', before.group, after.group)
  // A node without a status counts as defined.
  collect(changes, 'status', before.status ?? 'defined', after.status ?? 'defined')
  if (before.position.x !== after.position.x || before.position.y !== after.position.y) {
    changes.push({
      field: 'position',
      before: formatPosition(before.position),
      after: formatPosition(after.position),
    })
  }

  if (changes.length === 0) return null
  return {
    id: after.id,
    before,
    after,
    changes,
    movedOnly: changes.length === 1 && changes[0].field === 'position',
  }
}

function diffEdge(before: WorkflowEdge, after: WorkflowEdge): EdgeChange | null {
  const changes: FieldChange<EdgeField>[] = []
  collect(changes, 'source', before.source, after.source)
  collect(changes, 'target', before.target, after.target)
  collect(changes, 'label', before.label, after.label)
  collect(changes, 'kind', before.kind, after.kind)
  // An edge without a stored route is drawn with the default route, so a missing value is shown as 'auto'.
  collect(changes, 'sourceSide', before.sourceSide ?? '', after.sourceSide ?? '', 'auto')
  collect(changes, 'targetSide', before.targetSide ?? '', after.targetSide ?? '', 'auto')
  collect(changes, 'sourceOffset', formatOffset(before.sourceOffset), formatOffset(after.sourceOffset), 'auto')
  collect(changes, 'targetOffset', formatOffset(before.targetOffset), formatOffset(after.targetOffset), 'auto')
  collect(changes, 'routeOffset', formatOffset(before.routeOffset), formatOffset(after.routeOffset), 'auto')

  if (changes.length === 0) return null
  return { id: after.id, before, after, changes }
}

/** Records a change when the two values differ. Empty text is shown as `emptyLabel`. */
function collect<F extends string>(
  changes: FieldChange<F>[],
  field: F,
  before: string,
  after: string,
  emptyLabel = '(empty)',
): void {
  if (before === after) return
  changes.push({
    field,
    before: before === '' ? emptyLabel : before,
    after: after === '' ? emptyLabel : after,
  })
}

function formatPosition(position: { x: number; y: number }): string {
  return `(${formatCoordinate(position.x)}, ${formatCoordinate(position.y)})`
}

function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(2)))
}

/** An optional route offset as text. A missing offset is an empty string. */
function formatOffset(value: number | undefined): string {
  return value === undefined ? '' : formatCoordinate(value)
}