import { MarkerType } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import type {
  Workflow,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowEdgeStyle,
  WorkflowNode,
  WorkflowNodeShape,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../../types'

/** React Flow node type used for the swimlane background of a group. */
export const SWIMLANE_NODE_TYPE = 'swimlane'

/** Rendered size of a workflow node in the example flowchart, used to size the swimlanes. */
export const NODE_WIDTH = 150
export const NODE_HEIGHT = 60

/** Height of one lane row, and the width of the left gutter that holds the lane name. */
const LANE_HEIGHT = 130
const LANE_GUTTER = 160
const LANE_PADDING_X = 40

/** Preferred order of the swimlanes. Groups not listed here are added after these. */
export const LANE_ORDER = [
  'Design',
  'IntentForge',
  'PenEd',
  'PenEdTools',
  'Finance',
  'Marketing',
]

/** Owner handle shown under the lane name in the gutter, as in the example flowchart. */
const LANE_OWNERS: Record<string, string> = {
  Design: '@shelly',
  IntentForge: '@paul',
  PenEd: '@paul',
  PenEdTools: 'admin',
  Finance: '@dan',
  Marketing: '@bianca',
}

/** Data carried by a workflow node on the canvas. */
export type WorkflowFlowNodeData = {
  label: string
  description: string
  nodeType: WorkflowNodeType
  status: WorkflowNodeStatus
  group: string
  ownerId?: string
  /** Lane and column from the example's lane-and-column layout, kept so they survive editing. */
  lane?: string
  column?: number
  /** Display name of an owner who is not a stored team member. */
  ownerLabel?: string
  /** Visual shape of the node (start/end, process, decision or artifact). */
  shape?: WorkflowNodeShape
}

/** Data carried by a swimlane background node. */
export type SwimlaneNodeData = {
  label: string
  /** Owner handle shown under the lane name, when the lane has one. */
  owner?: string
  /** Background tone of the lane band: lanes alternate between 0 and 1. */
  tone: 0 | 1
}

/** Data carried by an edge on the canvas. */
export type WorkflowFlowEdgeData = {
  kind: WorkflowEdgeKind
  /** Line style: normal flow, feedback loop or failure path. */
  style?: WorkflowEdgeStyle
}

export type WorkflowFlowNode =
  | Node<WorkflowFlowNodeData, WorkflowNodeType>
  | Node<SwimlaneNodeData, typeof SWIMLANE_NODE_TYPE>

export type WorkflowFlowEdge = Edge<WorkflowFlowEdgeData>

export interface FlowGraph {
  nodes: WorkflowFlowNode[]
  edges: WorkflowFlowEdge[]
}

/** Edge kinds that are drawn animated: they represent something being triggered or handed over. */
const ANIMATED_KINDS: ReadonlySet<WorkflowEdgeKind> = new Set<WorkflowEdgeKind>([
  'trigger',
  'handoff',
])

/** Class names for an edge: one per kind, plus one for a feedback or failure line style. */
function edgeClassName(
  kind: WorkflowEdgeKind,
  style?: WorkflowEdgeStyle,
): string {
  const base = `flow-edge flow-edge--${kind}`
  return style && style !== 'flow' ? `${base} flow-edge--${style}` : base
}

function swimlaneId(group: string): string {
  return `lane-${group}`
}

function orderGroups(groups: string[]): string[] {
  const known = LANE_ORDER.filter((group) => groups.includes(group))
  const others = groups.filter((group) => !LANE_ORDER.includes(group))
  return [...known, ...others]
}

/** Builds one background node per group, sized to wrap all the nodes of that group. */
function buildSwimlanes(workflow: Workflow): WorkflowFlowNode[] {
  const bounds = new Map<
    string,
    { minX: number; minY: number; maxX: number; maxY: number }
  >()

  for (const node of workflow.nodes) {
    const current = bounds.get(node.group)
    const { x, y } = node.position
    if (!current) {
      bounds.set(node.group, { minX: x, minY: y, maxX: x, maxY: y })
    } else {
      current.minX = Math.min(current.minX, x)
      current.minY = Math.min(current.minY, y)
      current.maxX = Math.max(current.maxX, x)
      current.maxY = Math.max(current.maxY, y)
    }
  }

  // Every lane spans the full width of the diagram, with a gutter on the left for its name.
  let left = Infinity
  let right = -Infinity
  for (const box of bounds.values()) {
    left = Math.min(left, box.minX)
    right = Math.max(right, box.maxX)
  }
  const laneX = left - LANE_GUTTER
  const laneWidth = right - left + NODE_WIDTH + LANE_GUTTER + LANE_PADDING_X

  return orderGroups([...bounds.keys()]).map((group, index) => {
    const box = bounds.get(group)!
    const verticalPadding = (LANE_HEIGHT - NODE_HEIGHT) / 2
    const height = Math.max(
      LANE_HEIGHT,
      box.maxY - box.minY + NODE_HEIGHT + verticalPadding * 2,
    )
    const owner = LANE_OWNERS[group]
    return {
      id: swimlaneId(group),
      type: SWIMLANE_NODE_TYPE,
      position: {
        x: laneX,
        y: box.minY - verticalPadding,
      },
      data: { label: group, ...(owner ? { owner } : {}), tone: index % 2 === 0 ? 0 : 1 },
      style: { width: laneWidth, height },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      zIndex: -1,
    }
  })
}

/**
 * Maps a stored Workflow to React Flow nodes and edges.
 * Swimlane background nodes come first so they render behind the workflow nodes.
 * Edges that point to a missing node are dropped so React Flow never receives a dangling connection.
 */
export function mapWorkflowToFlow(workflow: Workflow): FlowGraph {
  const workflowNodes: WorkflowFlowNode[] = workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.label,
      description: node.description,
      nodeType: node.type,
      status: node.status ?? 'defined',
      group: node.group,
      ...(node.ownerId ? { ownerId: node.ownerId } : {}),
      ...(node.lane ? { lane: node.lane } : {}),
      ...(node.column !== undefined ? { column: node.column } : {}),
      ...(node.ownerLabel ? { ownerLabel: node.ownerLabel } : {}),
      ...(node.shape ? { shape: node.shape } : {}),
    },
    zIndex: 1,
  }))

  const nodeIds = new Set(workflow.nodes.map((node) => node.id))

  const edges: WorkflowFlowEdge[] = workflow.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.label || undefined,
      animated: ANIMATED_KINDS.has(edge.kind),
      className: edgeClassName(edge.kind, edge.style),
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { kind: edge.kind, ...(edge.style ? { style: edge.style } : {}) },
      zIndex: 2,
    }))

  return {
    nodes: [...buildSwimlanes(workflow), ...workflowNodes],
    edges,
  }
}

/** True for React Flow nodes that represent a workflow node (not a swimlane background). */
export function isWorkflowCardNode(
  node: WorkflowFlowNode,
): node is Node<WorkflowFlowNodeData, WorkflowNodeType> {
  return node.type !== SWIMLANE_NODE_TYPE
}

/**
 * Returns an id starting with the given prefix that is not in `existingIds`.
 * Used when the user adds a node or an edge so new ids never collide with stored ones.
 */
export function createUniqueId(
  prefix: string,
  existingIds: Iterable<string>,
): string {
  const taken = new Set(existingIds)
  let counter = taken.size + 1
  let candidate = `${prefix}-${counter}`
  while (taken.has(candidate)) {
    counter += 1
    candidate = `${prefix}-${counter}`
  }
  return candidate
}

/**
 * Maps edited React Flow nodes and edges back to a stored Workflow so the
 * changes can be persisted. Positions, labels, descriptions, owners, statuses,
 * groups and node types are read from the canvas, so added nodes and edges are
 * included and deleted ones are dropped. Swimlane background nodes are skipped
 * because they are derived from the node groups. Edges that point to a missing
 * node are dropped. The workflow id, name and version come from `base`.
 */
export function mapFlowToWorkflow(
  base: Workflow,
  nodes: WorkflowFlowNode[],
  edges: WorkflowFlowEdge[],
): Workflow {
  const workflowNodes: WorkflowNode[] = nodes.filter(isWorkflowCardNode).map((node) => {
    const { data } = node
    const stored: WorkflowNode = {
      id: node.id,
      label: data.label,
      type: data.nodeType,
      description: data.description,
      group: data.group,
      position: { x: node.position.x, y: node.position.y },
    }
    if (data.ownerId) stored.ownerId = data.ownerId
    if (data.lane) stored.lane = data.lane
    if (data.column !== undefined) stored.column = data.column
    if (data.ownerLabel) stored.ownerLabel = data.ownerLabel
    if (data.shape) stored.shape = data.shape
    if (data.status === 'needs-definition') stored.status = data.status
    return stored
  })

  const nodeIds = new Set(workflowNodes.map((node) => node.id))

  const workflowEdges: WorkflowEdge[] = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : '',
      kind: edge.data?.kind ?? 'data',
      ...(edge.data?.style ? { style: edge.data.style } : {}),
    }))

  return {
    id: base.id,
    name: base.name,
    version: base.version,
    nodes: workflowNodes,
    edges: workflowEdges,
  }
}

/** Builds a React Flow edge for a stored edge kind and label, matching the edges made by mapWorkflowToFlow. */
export function createFlowEdge(
  id: string,
  source: string,
  target: string,
  kind: WorkflowEdgeKind,
  label = '',
  style?: WorkflowEdgeStyle,
): WorkflowFlowEdge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    label: label || undefined,
    animated: ANIMATED_KINDS.has(kind),
    className: edgeClassName(kind, style),
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { kind, ...(style ? { style } : {}) },
    zIndex: 2,
  }
}