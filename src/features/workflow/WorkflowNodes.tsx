import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { WorkflowNodeType } from '../../types'
import { SWIMLANE_NODE_TYPE } from './flowMapping'
import type { SwimlaneNodeData, WorkflowFlowNodeData } from './flowMapping'

type WorkflowCardProps = NodeProps<Node<WorkflowFlowNodeData, WorkflowNodeType>>
type SwimlaneProps = NodeProps<Node<SwimlaneNodeData, typeof SWIMLANE_NODE_TYPE>>

/** Short text shown above the label so the node type is not conveyed by colour alone. */
const TYPE_LABELS: Record<WorkflowNodeType, string> = {
  actor: 'Actor',
  system: 'System',
  process: 'Process',
  artifact: 'Artifact',
  decision: 'Decision',
}

/**
 * Card used for every workflow node. The node type is added as a class
 * (workflow-node--actor, --system, --process, --artifact, --decision) so each
 * type can be styled differently in WorkflowPage.css.
 */
function WorkflowCard({ data, selected }: WorkflowCardProps) {
  const needsDefinition = data.status === 'needs-definition'
  const className = [
    'workflow-node',
    `workflow-node--${data.nodeType}`,
    needsDefinition ? 'workflow-node--needs-definition' : '',
    selected ? 'workflow-node--selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      title={data.description || undefined}
      data-node-type={data.nodeType}
      data-status={data.status}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="workflow-node__handle"
      />
      <div className="workflow-node__header">
        <span className="workflow-node__type">{TYPE_LABELS[data.nodeType]}</span>
        {needsDefinition ? (
          <span
            className="workflow-node__badge"
            role="status"
            aria-label="Needs definition"
          >
            Needs definition
          </span>
        ) : null}
      </div>
      <div className="workflow-node__label">{data.label}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="workflow-node__handle"
      />
    </div>
  )
}

/** Background band that groups the nodes of one area (IntentForge, PenEd, ...). */
function Swimlane({ data }: SwimlaneProps) {
  return (
    <div className="swimlane" aria-hidden="true">
      <span className="swimlane__label">{data.label}</span>
    </div>
  )
}

const WorkflowCardNode = memo(WorkflowCard)
const SwimlaneNode = memo(Swimlane)

/**
 * Maps React Flow node types to components. Defined at module level so the
 * object keeps the same identity between renders.
 */
export const nodeTypes = {
  actor: WorkflowCardNode,
  system: WorkflowCardNode,
  process: WorkflowCardNode,
  artifact: WorkflowCardNode,
  decision: WorkflowCardNode,
  [SWIMLANE_NODE_TYPE]: SwimlaneNode,
}