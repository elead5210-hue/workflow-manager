import { MarkerType } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import type {
  Workflow,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowEdgeSide,
  WorkflowEdgeStyle,
  WorkflowNode,
  WorkflowNodeShape,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../../types'

/** React Flow node type used for the swimlane background of a group. */
export const SWIMLANE_NODE_TYPE = 'swimlane'

/** React Flow edge type of the custom orthogonal edge, registered in WorkflowEdges.tsx. */
export const WORKFLOW_EDGE_TYPE = 'workflow'

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

/**
 * How an edge is routed: the side it leaves and arrives at, and pixel offsets.
 * sourceOffset and targetOffset slide the end points along their sides, and routeOffset
 * moves the middle segment away from the straight path.
 */
export type EdgeRoute = Pick<
  WorkflowEdge,
  'sourceSide' | 'targetSide' | 'sourceOffset' | 'targetOffset' | 'routeOffset'
>

/** Data carried by an edge on the canvas. */
export type WorkflowFlowEdgeData = {
  kind: WorkflowEdgeKind
  /** Line style: normal flow, feedback loop or failure path. */
  style?: WorkflowEdgeStyle
} & EdgeRoute

export type WorkflowFlowNode =
  | Node<WorkflowFlowNodeData, WorkflowNodeType>
  | Node<SwimlaneNodeData, typeof SWIMLANE_NODE_TYPE>

export type WorkflowFlowEdge = Edge<WorkflowFlowEdgeData>

export interface FlowGraph {
  nodes: WorkflowFlowNode[]
  edges: WorkflowFlowEdge[]
}

const EDGE_SIDES: readonly WorkflowEdgeSide[] = ['top', 'bottom', 'left', 'right']

/** Reads a React Flow handle id as an edge side, or undefined when it is not one. */
function asSide(value: string | null | undefined): WorkflowEdgeSide | undefined {
  return EDGE_SIDES.find((side) => side === value)
}

/** How far beneath the nodes a backward same-lane edge loops, in pixels. */
const BACKWARD_LOOP_OFFSET = 40

/**
 * Routing defaults for an edge that has no stored route.
 * - Same lane, forward: leaves on the right and arrives on the left, as a straight line.
 * - Same lane, backward: leaves and arrives on the bottom and loops beneath the nodes.
 * - Cross lane: leaves from the bottom (or the top when the target lane is above) and runs
 *   along the lane boundary.
 */
export function defaultEdgeRoute(
  source: Pick<WorkflowNode, 'group' | 'position'>,
  target: Pick<WorkflowNode, 'group' | 'position'>,
): EdgeRoute {
  if (source.group === target.group) {
    if (target.position.x > source.position.x) {
      return { sourceSide: 'right', targetSide: 'left' }
    }
    return {
      sourceSide: 'bottom',
      targetSide: 'bottom',
      routeOffset: BACKWARD_LOOP_OFFSET,
    }
  }
  if (target.position.y >= source.position.y) {
    return { sourceSide: 'bottom', targetSide: 'top', routeOffset: 0 }
  }
  return { sourceSide: 'top', targetSide: 'bottom', routeOffset: 0 }
}

/** The route of a stored edge: its own values where it has them, the defaults for the rest. */
function resolveEdgeRoute(
  edge: WorkflowEdge,
  source: Pick<WorkflowNode, 'group' | 'position'>,
  target: Pick<WorkflowNode, 'group' | 'position'>,
): EdgeRoute {
  const route: EdgeRoute = { ...defaultEdgeRoute(source, target) }
  if (edge.sourceSide) route.sourceSide = edge.sourceSide
  if (edge.targetSide) route.targetSide = edge.targetSide
  if (edge.sourceOffset !== undefined) route.sourceOffset = edge.sourceOffset
  if (edge.targetOffset !== undefined) route.targetOffset = edge.targetOffset
  if (edge.routeOffset !== undefined) route.routeOffset = edge.routeOffset
  return route
}

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

  const nodesById = new Map<string, WorkflowNode>(
    workflow.nodes.map((node) => [node.id, node] as const),
  )

  const edges: WorkflowFlowEdge[] = workflow.edges.flatMap((edge) => {
    const source = nodesById.get(edge.source)
    const target = nodesById.get(edge.target)
    if (!source || !target) return []
    return [
      createFlowEdge(
        edge.id,
        edge.source,
        edge.target,
        edge.kind,
        edge.label,
        edge.style,
        resolveEdgeRoute(edge, source, target),
      ),
    ]
  })

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
    .map((edge) => {
      // The route is kept as it is on the canvas. When the data has no side, the side of the
      // handle the edge is attached to is used, so reconnecting an edge keeps its new side.
      const sourceSide = edge.data?.sourceSide ?? asSide(edge.sourceHandle)
      const targetSide = edge.data?.targetSide ?? asSide(edge.targetHandle)
      const sourceOffset = edge.data?.sourceOffset
      const targetOffset = edge.data?.targetOffset
      const routeOffset = edge.data?.routeOffset
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: typeof edge.label === 'string' ? edge.label : '',
        kind: edge.data?.kind ?? 'data',
        ...(edge.data?.style ? { style: edge.data.style } : {}),
        ...(sourceSide ? { sourceSide } : {}),
        ...(targetSide ? { targetSide } : {}),
        ...(sourceOffset !== undefined ? { sourceOffset } : {}),
        ...(targetOffset !== undefined ? { targetOffset } : {}),
        ...(routeOffset !== undefined ? { routeOffset } : {}),
      }
    })

  return {
    id: base.id,
    name: base.name,
    version: base.version,
    nodes: workflowNodes,
    edges: workflowEdges,
  }
}

/**
 * Builds a React Flow edge for a stored edge kind, label and route, matching the edges made by
 * mapWorkflowToFlow. The sides of the route select the handles the edge attaches to, and the
 * whole route is kept in the edge data for the custom edge component and for saving.
 */
export function createFlowEdge(
  id: string,
  source: string,
  target: string,
  kind: WorkflowEdgeKind,
  label = '',
  style?: WorkflowEdgeStyle,
  route: EdgeRoute = {},
): WorkflowFlowEdge {
  return {
    id,
    source,
    target,
    type: WORKFLOW_EDGE_TYPE,
    ...(route.sourceSide ? { sourceHandle: route.sourceSide } : {}),
    ...(route.targetSide ? { targetHandle: route.targetSide } : {}),
    label: label || undefined,
    className: edgeClassName(kind, style),
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { kind, ...(style ? { style } : {}), ...route },
    zIndex: 2,
  }
}