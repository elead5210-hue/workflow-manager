// Build, serialize, parse and validate the JSON file used to back up and share
// the workflow and the team members.
//
// Parsing never throws. It returns either the validated bundle or a list of
// plain-language problems that name the part of the file they refer to, so the
// import screen can show them as they are.
import type {
  ExportBundle,
  Position,
  TeamMember,
  Workflow,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowEdgeSide,
  WorkflowNode,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../types'

/** Version of the export file layout. Bump it when the layout changes in a way older readers cannot handle. */
export const EXPORT_FORMAT_VERSION = 1

/** Most problems listed for one file, so a badly broken file stays readable. */
const MAX_REPORTED_PROBLEMS = 20

const NODE_TYPES: readonly WorkflowNodeType[] = [
  'actor',
  'system',
  'process',
  'artifact',
  'decision',
]
const EDGE_KINDS: readonly WorkflowEdgeKind[] = ['data', 'handoff', 'trigger']
const EDGE_SIDES: readonly WorkflowEdgeSide[] = ['top', 'bottom', 'left', 'right']
const NODE_STATUSES: readonly WorkflowNodeStatus[] = ['defined', 'needs-definition']

/** The result of reading an export file: the checked bundle, or every problem found. */
export type ExportParseResult =
  | { ok: true; bundle: ExportBundle }
  | { ok: false; errors: string[] }

type Problems = string[]

interface StringOptions {
  /** When true, a missing value (or null) is accepted and the result is undefined. */
  optional?: boolean
  /** When false, text that is empty after trimming is reported as a problem. Defaults to true. */
  allowEmpty?: boolean
}

/** Packs the members and the workflow into the object that is written to the export file. */
export function buildExportBundle(
  members: TeamMember[],
  workflow: Workflow | null,
  exportedAt: Date = new Date(),
): ExportBundle {
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    workflow,
    members,
  }
}

/** Turns a bundle into the text of the export file: indented JSON with a final line break. */
export function serializeExportBundle(bundle: ExportBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`
}

/** A file name such as "workflow-manager-2026-10-08.json", using the local date. */
export function createExportFileName(exportedAt: Date = new Date()): string {
  const year = exportedAt.getFullYear()
  const month = String(exportedAt.getMonth() + 1).padStart(2, '0')
  const day = String(exportedAt.getDate()).padStart(2, '0')
  return `workflow-manager-${year}-${month}-${day}.json`
}

/**
 * Reads the text of an export file and checks it.
 * The workflow in a valid bundle can be null, which means the file carried
 * members only; what to do with that on import is up to the caller.
 */
export function parseExportBundle(text: string): ExportParseResult {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (trimmed === '') {
    return { ok: false, errors: ['The file is empty.'] }
  }

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return { ok: false, errors: [`The file is not valid JSON (${reason}).`] }
  }

  return validateExportBundle(data)
}

/**
 * Checks an already parsed value against the export layout.
 * Fields that older or hand-edited files may leave out (notes, lists, descriptions,
 * labels, createdAt) get empty defaults; everything else must be present and
 * correct. Members and nodes must have unique ids, nodes may only be owned by
 * members in the same file, and edges may only join nodes in the same file.
 */
export function validateExportBundle(value: unknown): ExportParseResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: [`The file must contain a JSON object (found ${found(value)}).`],
    }
  }

  const problems: Problems = []

  const formatVersion = readFormatVersion(value, problems)
  if (formatVersion !== undefined && formatVersion > EXPORT_FORMAT_VERSION) {
    return {
      ok: false,
      errors: [
        `This file uses export format ${formatVersion}, but this version of the app only reads format ${EXPORT_FORMAT_VERSION}. Update the app and try again.`,
      ],
    }
  }

  const exportedAt = readTimestamp(value, 'exportedAt', '', problems, false)

  const members: TeamMember[] = []
  const memberIds = new Set<string>()
  const problemsBeforeMembers = problems.length
  readList(value, 'members', '', problems).forEach((raw, index) => {
    const member = readMember(raw, index, exportedAt ?? '', problems)
    if (!member) return
    if (memberIds.has(member.id)) {
      problems.push(`members[${index}] repeats the id "${member.id}".`)
      return
    }
    memberIds.add(member.id)
    members.push(member)
  })
  const membersValid = problems.length === problemsBeforeMembers

  let workflow: Workflow | null = null
  if ('workflow' in value) {
    workflow = readWorkflow(value.workflow, membersValid ? memberIds : null, problems)
  } else {
    problems.push('workflow is missing. Use null when the file has no workflow.')
  }

  if (problems.length > 0 || formatVersion === undefined || exportedAt === undefined) {
    return { ok: false, errors: limitProblems(problems) }
  }

  return {
    ok: true,
    bundle: { formatVersion, exportedAt, workflow, members },
  }
}

function readFormatVersion(
  record: Record<string, unknown>,
  problems: Problems,
): number | undefined {
  const value = record.formatVersion
  if (value === undefined) {
    problems.push(
      'formatVersion is missing, so this does not look like a Workflow Manager export.',
    )
    return undefined
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    problems.push(`formatVersion must be a whole number of 1 or more (found ${found(value)}).`)
    return undefined
  }
  return value
}

function readMember(
  value: unknown,
  index: number,
  fallbackCreatedAt: string,
  problems: Problems,
): TeamMember | null {
  const path = `members[${index}]`
  if (!isRecord(value)) {
    problems.push(`${path} must be an object (found ${found(value)}).`)
    return null
  }

  const id = readString(value, 'id', path, problems, { allowEmpty: false })
  const name = readString(value, 'name', path, problems, { allowEmpty: false })
  const role = readString(value, 'role', path, problems, { allowEmpty: false })
  const responsibilities = readStringList(value, 'responsibilities', path, problems)
  const primaryApps = readStringList(value, 'primaryApps', path, problems)
  const notes = readString(value, 'notes', path, problems, { optional: true }) ?? ''
  const createdAt =
    readTimestamp(value, 'createdAt', path, problems, true) ?? fallbackCreatedAt

  if (id === undefined || name === undefined || role === undefined) return null
  return { id, name, role, responsibilities, primaryApps, notes, createdAt }
}

function readWorkflow(
  value: unknown,
  memberIds: ReadonlySet<string> | null,
  problems: Problems,
): Workflow | null {
  if (value === null) return null

  const path = 'workflow'
  if (!isRecord(value)) {
    problems.push(`workflow must be an object or null (found ${found(value)}).`)
    return null
  }

  const id = readString(value, 'id', path, problems, { allowEmpty: false })
  const name = readString(value, 'name', path, problems, { allowEmpty: false })
  const version = readWorkflowVersion(value, problems)
  const updatedAt = readTimestamp(value, 'updatedAt', path, problems, true)

  const nodes: WorkflowNode[] = []
  const nodeIds = new Set<string>()
  const problemsBeforeNodes = problems.length
  readList(value, 'nodes', path, problems).forEach((raw, index) => {
    const node = readNode(raw, index, memberIds, problems)
    if (!node) return
    if (nodeIds.has(node.id)) {
      problems.push(`workflow.nodes[${index}] repeats the id "${node.id}".`)
      return
    }
    nodeIds.add(node.id)
    nodes.push(node)
  })
  // Edge references are only checked when every node was readable, so one bad
  // node does not produce a pile of follow-on errors.
  const nodesValid = problems.length === problemsBeforeNodes

  const edges: WorkflowEdge[] = []
  const edgeIds = new Set<string>()
  readList(value, 'edges', path, problems).forEach((raw, index) => {
    const edge = readEdge(raw, index, nodesValid ? nodeIds : null, problems)
    if (!edge) return
    if (edgeIds.has(edge.id)) {
      problems.push(`workflow.edges[${index}] repeats the id "${edge.id}".`)
      return
    }
    edgeIds.add(edge.id)
    edges.push(edge)
  })

  if (id === undefined || name === undefined || version === undefined) return null
  return {
    id,
    name,
    version,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    nodes,
    edges,
  }
}

function readWorkflowVersion(
  record: Record<string, unknown>,
  problems: Problems,
): number | undefined {
  const value = record.version
  if (value === undefined) {
    problems.push('workflow.version is missing.')
    return undefined
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    problems.push(
      `workflow.version must be a whole number of 1 or more (found ${found(value)}).`,
    )
    return undefined
  }
  return value
}

function readNode(
  value: unknown,
  index: number,
  memberIds: ReadonlySet<string> | null,
  problems: Problems,
): WorkflowNode | null {
  const path = `workflow.nodes[${index}]`
  if (!isRecord(value)) {
    problems.push(`${path} must be an object (found ${found(value)}).`)
    return null
  }

  const id = readString(value, 'id', path, problems, { allowEmpty: false })
  const label = readString(value, 'label', path, problems, { allowEmpty: false })
  const type = readChoice(value, 'type', path, problems, NODE_TYPES, false)
  const description =
    readString(value, 'description', path, problems, { optional: true }) ?? ''
  const group = readString(value, 'group', path, problems, { allowEmpty: false })
  const ownerId = readString(value, 'ownerId', path, problems, {
    optional: true,
    allowEmpty: false,
  })
  const position = readPosition(value, path, problems)
  const status = readChoice(value, 'status', path, problems, NODE_STATUSES, true)

  if (ownerId !== undefined && memberIds !== null && !memberIds.has(ownerId)) {
    problems.push(
      `${path}.ownerId refers to "${ownerId}", which is not one of the members in this file.`,
    )
  }

  if (
    id === undefined ||
    label === undefined ||
    type === undefined ||
    group === undefined ||
    position === undefined
  ) {
    return null
  }
  return {
    id,
    label,
    type,
    description,
    ...(ownerId !== undefined ? { ownerId } : {}),
    group,
    position,
    ...(status !== undefined ? { status } : {}),
  }
}

function readEdge(
  value: unknown,
  index: number,
  nodeIds: ReadonlySet<string> | null,
  problems: Problems,
): WorkflowEdge | null {
  const path = `workflow.edges[${index}]`
  if (!isRecord(value)) {
    problems.push(`${path} must be an object (found ${found(value)}).`)
    return null
  }

  const id = readString(value, 'id', path, problems, { allowEmpty: false })
  const source = readString(value, 'source', path, problems, { allowEmpty: false })
  const target = readString(value, 'target', path, problems, { allowEmpty: false })
  const label = readString(value, 'label', path, problems, { optional: true }) ?? ''
  const kind = readChoice(value, 'kind', path, problems, EDGE_KINDS, false)
  const sourceSide = readChoice(value, 'sourceSide', path, problems, EDGE_SIDES, true)
  const targetSide = readChoice(value, 'targetSide', path, problems, EDGE_SIDES, true)
  const sourceOffset = readNumber(value, 'sourceOffset', path, problems)
  const targetOffset = readNumber(value, 'targetOffset', path, problems)
  const routeOffset = readNumber(value, 'routeOffset', path, problems)

  if (nodeIds !== null) {
    if (source !== undefined && !nodeIds.has(source)) {
      problems.push(`${path}.source refers to "${source}", which is not a node in this workflow.`)
    }
    if (target !== undefined && !nodeIds.has(target)) {
      problems.push(`${path}.target refers to "${target}", which is not a node in this workflow.`)
    }
  }

  if (id === undefined || source === undefined || target === undefined || kind === undefined) {
    return null
  }
  return {
    id,
    source,
    target,
    label,
    kind,
    ...(sourceSide !== undefined ? { sourceSide } : {}),
    ...(targetSide !== undefined ? { targetSide } : {}),
    ...(sourceOffset !== undefined ? { sourceOffset } : {}),
    ...(targetOffset !== undefined ? { targetOffset } : {}),
    ...(routeOffset !== undefined ? { routeOffset } : {}),
  }
}

/** An optional number. A missing value (or null) is accepted and read as undefined. */
function readNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: Problems,
): number | undefined {
  const value = record[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    problems.push(`${at(path, key)} must be a number (found ${found(value)}).`)
    return undefined
  }
  return value
}

function readPosition(
  record: Record<string, unknown>,
  path: string,
  problems: Problems,
): Position | undefined {
  const value = record.position
  if (value === undefined) {
    problems.push(`${at(path, 'position')} is missing.`)
    return undefined
  }
  if (
    !isRecord(value) ||
    typeof value.x !== 'number' ||
    !Number.isFinite(value.x) ||
    typeof value.y !== 'number' ||
    !Number.isFinite(value.y)
  ) {
    problems.push(`${at(path, 'position')} must be an object with numeric x and y.`)
    return undefined
  }
  return { x: value.x, y: value.y }
}

function readString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: Problems,
  { optional = false, allowEmpty = true }: StringOptions = {},
): string | undefined {
  const value = record[key]
  if (value === undefined || (optional && value === null)) {
    if (!optional) problems.push(`${at(path, key)} is missing.`)
    return undefined
  }
  if (typeof value !== 'string') {
    problems.push(`${at(path, key)} must be text (found ${found(value)}).`)
    return undefined
  }
  if (!allowEmpty && value.trim() === '') {
    problems.push(`${at(path, key)} must not be empty.`)
    return undefined
  }
  return value
}

function readTimestamp(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: Problems,
  optional: boolean,
): string | undefined {
  const value = readString(record, key, path, problems, { optional, allowEmpty: false })
  if (value === undefined) return undefined
  if (Number.isNaN(Date.parse(value))) {
    problems.push(
      `${at(path, key)} must be a date and time such as "2026-10-08T12:00:00.000Z" (found ${found(value)}).`,
    )
    return undefined
  }
  return value
}

function readChoice<T extends string>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: Problems,
  choices: readonly T[],
  optional: boolean,
): T | undefined {
  const value = record[key]
  if (value === undefined || (optional && value === null)) {
    if (!optional) problems.push(`${at(path, key)} is missing.`)
    return undefined
  }
  const match = choices.find((choice) => choice === value)
  if (match === undefined) {
    const allowed = choices.map((choice) => `"${choice}"`).join(', ')
    problems.push(`${at(path, key)} must be one of ${allowed} (found ${found(value)}).`)
  }
  return match
}

/** A list of text values. A missing list counts as empty. */
function readStringList(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: Problems,
): string[] {
  const value = record[key]
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    problems.push(`${at(path, key)} must be a list of text (found ${found(value)}).`)
    return []
  }
  const items: string[] = []
  const list: unknown[] = value
  list.forEach((item, index) => {
    if (typeof item === 'string') {
      items.push(item)
    } else {
      problems.push(`${at(path, key)}[${index}] must be text (found ${found(item)}).`)
    }
  })
  return items
}

/** A list that must be present. Anything else is reported and read as empty. */
function readList(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: Problems,
): unknown[] {
  const value = record[key]
  if (value === undefined) {
    problems.push(`${at(path, key)} is missing.`)
    return []
  }
  if (!Array.isArray(value)) {
    problems.push(`${at(path, key)} must be a list (found ${found(value)}).`)
    return []
  }
  const list: unknown[] = value
  return list
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The path of a field, such as "members[2].name"; top-level fields have no prefix. */
function at(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`
}

/** Describes what was actually found, for use in problem messages. */
function found(value: unknown): string {
  if (value === undefined) return 'nothing'
  if (value === null) return 'null'
  if (typeof value === 'string') {
    const shown = value.length > 40 ? `${value.slice(0, 40)}...` : value
    return `"${shown}"`
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return 'a list'
  if (typeof value === 'object') return 'an object'
  return `a value of type ${typeof value}`
}

function limitProblems(problems: Problems): string[] {
  if (problems.length === 0) {
    return ['The file is not a valid Workflow Manager export.']
  }
  if (problems.length <= MAX_REPORTED_PROBLEMS) return problems
  const extra = problems.length - MAX_REPORTED_PROBLEMS
  return [
    ...problems.slice(0, MAX_REPORTED_PROBLEMS),
    `and ${extra} more ${extra === 1 ? 'problem' : 'problems'}.`,
  ]
}