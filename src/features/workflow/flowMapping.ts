import { MarkerType } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import type {
  Workflow,
  WorkflowEdgeKind,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../../types'

/** React Flow node type used for the swimlane background of a group. */
export const SWIMLANE_NODE_TYPE = 'swimlane'

/** Approximate rendered size of a workflow node, used to size the swimlanes. */
export const NODE_WIDTH = 200
export const NODE_HEIGHT = 80

const LANE_PADDING_X = 40
const LANE_PADDING_TOP = 56
const LANE_PADDING_BOTTOM = 40

/** Preferred order of the swimlanes. Groups not listed here are added after these. */
export const LANE_ORDER = [
  'IntentForge',
  'PenEd',
  'PenEdTools',
  'Design',
  'Finance',
  'Marketing',
]

/** Data carried by a workflow node on the canvas. */
export type WorkflowFlowNodeData = {
  label: string
  description: string
  nodeType: WorkflowNodeType
  status: WorkflowNodeStatus
  group: string
  ownerId?: string
}

/** Data carried by a swimlane background node. */
export type SwimlaneNodeData = {
  label: string
}

/** Data carried by an edge on the canvas. */
export type WorkflowFlowEdgeData = {
  kind: WorkflowEdgeKind
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

  return orderGroups([...bounds.keys()]).map((group) => {
    const box = bounds.get(group)!
    const width = box.maxX - box.minX + NODE_WIDTH + LANE_PADDING_X * 2
    const height =
      box.maxY - box.minY + NODE_HEIGHT + LANE_PADDING_TOP + LANE_PADDING_BOTTOM
    return {
      id: swimlaneId(group),
      type: SWIMLANE_NODE_TYPE,
      position: {
        x: box.minX - LANE_PADDING_X,
        y: box.minY - LANE_PADDING_TOP,
      },
      data: { label: group },
      style: { width, height },
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
      className: `flow-edge flow-edge--${edge.kind}`,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { kind: edge.kind },
      zIndex: 2,
    }))

  return {
    nodes: [...buildSwimlanes(workflow), ...workflowNodes],
    edges,
  }
}