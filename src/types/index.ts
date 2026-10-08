// Shared domain types for the workflow manager.
// The DB layer, seed data and UI all import these types so they agree on one model.

/** A person on the team, with their role and the apps they own. */
export interface TeamMember {
  id: string
  name: string
  role: string
  responsibilities: string[]
  primaryApps: string[]
  /** Free-form bio or notes about the member. */
  notes: string
  /** ISO 8601 timestamp. */
  createdAt: string
}

/** A tracked app, saved as a record so the team can see which apps are part of the workflow. */
export interface AppRecord {
  id: string
  name: string
  /** What the app does. May be empty. */
  description: string
  /** Who owns or looks after the app, as free text. May be empty. */
  owner: string
  /** Free-form notes about the app. May be empty. */
  notes: string
  /** ISO 8601 timestamp. */
  createdAt: string
}

/** The kind of thing a workflow node represents. */
export type WorkflowNodeType =
  | 'actor'
  | 'system'
  | 'process'
  | 'artifact'
  | 'decision'

/** How two workflow nodes are connected. */
export type WorkflowEdgeKind = 'data' | 'handoff' | 'trigger'

/** Whether a workflow node is fully described or still needs clarification. */
export type WorkflowNodeStatus = 'defined' | 'needs-definition'

/** The visual shape of a workflow node, matching the kinds used in the example workflow. */
export type WorkflowNodeShape = 'terminal' | 'process' | 'decision' | 'artifact'

/** The line style of a workflow edge: the normal flow, a feedback loop or a failure path. */
export type WorkflowEdgeStyle = 'flow' | 'feedback' | 'failure'

/** The side of a node that an edge leaves from or arrives at. */
export type WorkflowEdgeSide = 'top' | 'bottom' | 'left' | 'right'

/** A position on the workflow canvas. */
export interface Position {
  x: number
  y: number
}

/** A single step, actor, system or artifact in the workflow diagram. */
export interface WorkflowNode {
  id: string
  label: string
  type: WorkflowNodeType
  description: string
  /** Optional reference to the TeamMember who owns this node. */
  ownerId?: string
  /** Group or swimlane the node belongs to (e.g. IntentForge, PenEd). */
  group: string
  position: Position
  /** Defaults to 'defined' when omitted. 'needs-definition' marks vague areas of the process. */
  status?: WorkflowNodeStatus
  /** Optional lane (row) the node sits in, for lane-and-column layouts such as the example workflow. */
  lane?: string
  /** Optional column index within the lane, used to place the node in a lane-and-column layout. */
  column?: number
  /** Optional display name of the owner, for owners that are not stored TeamMember records. */
  ownerLabel?: string
  /** Optional visual shape of the node. When omitted the shape follows the node type. */
  shape?: WorkflowNodeShape
}

/** A directed connection between two workflow nodes. */
export interface WorkflowEdge {
  id: string
  /** Id of the source WorkflowNode. */
  source: string
  /** Id of the target WorkflowNode. */
  target: string
  label: string
  kind: WorkflowEdgeKind
  /** Optional line style. When omitted the edge is drawn as a normal flow line. */
  style?: WorkflowEdgeStyle
  /** Optional side of the source node the edge leaves from. When omitted the side is chosen from the node positions. */
  sourceSide?: WorkflowEdgeSide
  /** Optional side of the target node the edge arrives at. When omitted the side is chosen from the node positions. */
  targetSide?: WorkflowEdgeSide
  /** Optional offset in pixels of the point where the edge leaves the source side, along that side. */
  sourceOffset?: number
  /** Optional offset in pixels of the point where the edge arrives at the target side, along that side. */
  targetOffset?: number
  /** Optional offset in pixels of the middle segment of the route, away from the straight path (for example to run along a lane boundary or loop around the diagram). */
  routeOffset?: number
}

/** A complete workflow made of nodes and the edges between them. */
export interface Workflow {
  id: string
  name: string
  version: number
  /** ISO 8601 timestamp of the last change. Absent on workflows stored before versioning was added. */
  updatedAt?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/** A saved copy of a workflow at one point in time, kept so earlier iterations can be compared or restored. */
export interface WorkflowSnapshot {
  id: string
  /** Id of the workflow this snapshot was taken from. */
  workflowId: string
  /** The workflow version number when the snapshot was taken. */
  version: number
  /** Short note describing this iteration. May be empty. */
  note: string
  /** ISO 8601 timestamp of when the snapshot was taken. */
  createdAt: string
  /** The full workflow exactly as it was at that time. */
  workflow: Workflow
}

/** The contents of a JSON export file holding the workflow and the team members. */
export interface ExportBundle {
  /** Version of the export file layout, so future changes can still read old files. */
  formatVersion: number
  /** ISO 8601 timestamp of when the file was exported. */
  exportedAt: string
  /** The exported workflow, or null when none was stored. */
  workflow: Workflow | null
  members: TeamMember[]
}