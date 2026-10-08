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