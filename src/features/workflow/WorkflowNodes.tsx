import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { WorkflowNodeShape, WorkflowNodeType } from '../../types'
import { SWIMLANE_NODE_TYPE } from './flowMapping'
import type { SwimlaneNodeData, WorkflowFlowNodeData } from './flowMapping'

type WorkflowCardProps = NodeProps<Node<WorkflowFlowNodeData, WorkflowNodeType>>
type SwimlaneProps = NodeProps<Node<SwimlaneNodeData, typeof SWIMLANE_NODE_TYPE>>

/**
 * Shape used when a node has none stored: decisions and artifacts keep their own
 * shape and every other node type is drawn as a process step.
 */
function shapeFor(
  nodeType: WorkflowNodeType,
  shape?: WorkflowNodeShape,
): WorkflowNodeShape {
  if (shape) return shape
  if (nodeType === 'decision') return 'decision'
  if (nodeType === 'artifact') return 'artifact'
  return 'process'
}

/**
 * Card used for every workflow node. The node type is added as a class
 * (workflow-node--actor, --system, --process, --artifact, --decision) so each
 * type can be styled differently in WorkflowPage.css. The shape of the example
 * workflow (terminal, process, decision, artifact) is added as a second class
 * (workflow-node--shape-terminal and so on), and the owner name is shown under
 * the label when the node has one.
 */
function WorkflowCard({ data, selected }: WorkflowCardProps) {
  const needsDefinition = data.status === 'needs-definition'
  const shape = shapeFor(data.nodeType, data.shape)
  const className = [
    'workflow-node',
    `workflow-node--${data.nodeType}`,
    `workflow-node--shape-${shape}`,
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
      data-shape={shape}
      data-status={data.status}
    >
      <div className="workflow-node__shape" aria-hidden="true" />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="workflow-node__handle"
      />
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="workflow-node__handle"
      />
      <Handle
        id="right"
        type="target"
        position={Position.Right}
        className="workflow-node__handle"
      />
      <Handle
        id="bottom"
        type="target"
        position={Position.Bottom}
        className="workflow-node__handle"
      />
      {needsDefinition ? (
        <span
          className="workflow-node__badge"
          role="img"
          aria-label="Needs definition"
          title="Needs definition"
        >
          ?
        </span>
      ) : null}
      <div className="workflow-node__label">{data.label}</div>
      {data.ownerLabel ? (
        <div className="workflow-node__owner">{data.ownerLabel}</div>
      ) : null}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="workflow-node__handle"
      />
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="workflow-node__handle"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="workflow-node__handle"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="workflow-node__handle"
      />
    </div>
  )
}

/**
 * Background band that groups the nodes of one lane (Design, IntentForge, ...). The lane name and
 * its owner handle sit in the left gutter, and the band tone alternates from lane to lane.
 */
function Swimlane({ data }: SwimlaneProps) {
  return (
    <div
      className={`swimlane swimlane--tone-${data.tone}`}
      aria-hidden="true"
      data-lane={data.label}
    >
      <span className="swimlane__label">{data.label}</span>
      {data.owner ? <span className="swimlane__owner">{data.owner}</span> : null}
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