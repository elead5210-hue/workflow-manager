import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Node } from '@xyflow/react'
import type {
  TeamMember,
  WorkflowEdgeKind,
  WorkflowEdgeStyle,
  WorkflowNodeShape,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../../types'
import type {
  WorkflowFlowEdge,
  WorkflowFlowNode,
  WorkflowFlowNodeData,
} from './flowMapping'

/** A workflow node as it exists on the canvas (not a swimlane background). */
export type SelectedWorkflowNode = Node<WorkflowFlowNodeData, WorkflowNodeType>

/**
 * The full set of editable node fields, sent when the user saves the edit form.
 * An `ownerId` of undefined means the node has no owner. The parent is expected
 * to copy `nodeType` to the React Flow node's `type` as well as to its data.
 */
export interface NodeChanges {
  label: string
  description: string
  nodeType: WorkflowNodeType
  status: WorkflowNodeStatus
  ownerId: string | undefined
}

/** The editable fields of an edge. */
export interface EdgeChanges {
  label: string
  kind: WorkflowEdgeKind
  /** Line style of the example workflow: flow, feedback or failure. */
  style?: WorkflowEdgeStyle
}

export interface NodeDetailsPanelProps {
  /** The selected node, or null when nothing is selected (the panel renders nothing). */
  node: SelectedWorkflowNode | null
  /** All nodes on the canvas, used to name the other end of each connected edge. */
  nodes: WorkflowFlowNode[]
  /** All edges on the canvas. The panel lists the ones connected to the selected node. */
  edges: WorkflowFlowEdge[]
  /** Team members that can own a node. */
  members: TeamMember[]
  onUpdateNode: (id: string, changes: NodeChanges) => void
  onDeleteNode: (id: string) => void
  onUpdateEdge: (id: string, changes: EdgeChanges) => void
  onDeleteEdge: (id: string) => void
  onClose: () => void
}

const NODE_TYPE_OPTIONS: { value: WorkflowNodeType; label: string }[] = [
  { value: 'actor', label: 'Actor' },
  { value: 'system', label: 'System' },
  { value: 'process', label: 'Process' },
  { value: 'artifact', label: 'Artifact' },
  { value: 'decision', label: 'Decision' },
]

const STATUS_OPTIONS: { value: WorkflowNodeStatus; label: string }[] = [
  { value: 'defined', label: 'Defined' },
  { value: 'needs-definition', label: 'Needs definition' },
]

const EDGE_KIND_OPTIONS: { value: WorkflowEdgeKind; label: string }[] = [
  { value: 'data', label: 'Data' },
  { value: 'handoff', label: 'Handoff' },
  { value: 'trigger', label: 'Trigger' },
]

/** The node shapes of the example workflow, shown in the details of a selected step. */
const SHAPE_OPTIONS: { value: WorkflowNodeShape; label: string }[] = [
  { value: 'terminal', label: 'Start / end' },
  { value: 'process', label: 'Process' },
  { value: 'decision', label: 'Decision' },
  { value: 'artifact', label: 'Artifact' },
]

/** The line styles of the example workflow. */
const EDGE_STYLE_OPTIONS: { value: WorkflowEdgeStyle; label: string }[] = [
  { value: 'flow', label: 'Flow' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'failure', label: 'Failure' },
]

/** The shape a node is drawn with: its stored shape, or one that follows its type. */
function shapeFor(
  nodeType: WorkflowNodeType,
  shape?: WorkflowNodeShape,
): WorkflowNodeShape {
  if (shape) return shape
  if (nodeType === 'decision') return 'decision'
  if (nodeType === 'artifact') return 'artifact'
  return 'process'
}

function labelFor<T extends string>(
  options: { value: T; label: string }[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function edgeLabelText(edge: WorkflowFlowEdge): string {
  return typeof edge.label === 'string' ? edge.label : ''
}

interface EdgeRowProps {
  edge: WorkflowFlowEdge
  direction: 'outgoing' | 'incoming'
  otherLabel: string
  onUpdate: (id: string, changes: EdgeChanges) => void
  onDelete: (id: string) => void
}

/** One connected edge, with controls to change its label and kind or to delete it. */
function EdgeRow({ edge, direction, otherLabel, onUpdate, onDelete }: EdgeRowProps) {
  const storedLabel = edgeLabelText(edge)
  const kind: WorkflowEdgeKind = edge.data?.kind ?? 'data'
  const style: WorkflowEdgeStyle = edge.data?.style ?? 'flow'
  const [draftLabel, setDraftLabel] = useState(storedLabel)

  // Keep the draft in step when the edge changes from outside this row.
  useEffect(() => {
    setDraftLabel(storedLabel)
  }, [storedLabel])

  const commitLabel = () => {
    const next = draftLabel.trim()
    if (next !== storedLabel) onUpdate(edge.id, { label: next, kind, style })
    setDraftLabel(next)
  }

  const idBase = `node-panel-edge-${edge.id}`

  return (
    <li className="node-panel__edge">
      <p className="node-panel__edge-title">
        <span className="node-panel__edge-direction">
          {direction === 'outgoing' ? 'To' : 'From'}
        </span>{' '}
        <strong>{otherLabel}</strong>
      </p>
      <div className="node-panel__edge-fields">
        <label className="node-panel__field" htmlFor={`${idBase}-label`}>
          <span className="node-panel__field-label">Label</span>
          <input
            id={`${idBase}-label`}
            className="node-panel__input"
            type="text"
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            onBlur={commitLabel}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitLabel()
              }
            }}
          />
        </label>
        <label className="node-panel__field" htmlFor={`${idBase}-kind`}>
          <span className="node-panel__field-label">Kind</span>
          <select
            id={`${idBase}-kind`}
            className="node-panel__select"
            value={kind}
            onChange={(event) =>
              onUpdate(edge.id, {
                label: draftLabel.trim(),
                kind: event.target.value as WorkflowEdgeKind,
                style,
              })
            }
          >
            {EDGE_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="node-panel__field" htmlFor={`${idBase}-style`}>
          <span className="node-panel__field-label">Line style</span>
          <select
            id={`${idBase}-style`}
            className="node-panel__select"
            value={style}
            onChange={(event) =>
              onUpdate(edge.id, {
                label: draftLabel.trim(),
                kind,
                style: event.target.value as WorkflowEdgeStyle,
              })
            }
          >
            {EDGE_STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="node-panel__button node-panel__button--danger"
        onClick={() => onDelete(edge.id)}
        aria-label={`Delete connection ${direction === 'outgoing' ? 'to' : 'from'} ${otherLabel}`}
      >
        Delete connection
      </button>
    </li>
  )
}

interface NodeDetailsProps extends Omit<NodeDetailsPanelProps, 'node'> {
  node: SelectedWorkflowNode
}

/** The panel content for one node. Remounted (via key) whenever the selection changes. */
function NodeDetails({
  node,
  nodes,
  edges,
  members,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onClose,
}: NodeDetailsProps) {
  const { data } = node
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data.label)
  const [draftDescription, setDraftDescription] = useState(data.description)
  const [draftType, setDraftType] = useState<WorkflowNodeType>(data.nodeType)
  const [draftStatus, setDraftStatus] = useState<WorkflowNodeStatus>(data.status)
  const [draftOwnerId, setDraftOwnerId] = useState(data.ownerId ?? '')
  const [showLabelError, setShowLabelError] = useState(false)

  // Move focus into the panel when it opens for a node.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const owner = data.ownerId
    ? members.find((member) => member.id === data.ownerId)
    : undefined

  const connected = edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  )

  const nodeLabelById = (id: string): string => {
    const other = nodes.find((candidate) => candidate.id === id)
    return other ? other.data.label : id
  }

  const startEditing = () => {
    setDraftLabel(data.label)
    setDraftDescription(data.description)
    setDraftType(data.nodeType)
    setDraftStatus(data.status)
    setDraftOwnerId(data.ownerId ?? '')
    setShowLabelError(false)
    setConfirmingDelete(false)
    setEditing(true)
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = draftLabel.trim()
    if (!label) {
      setShowLabelError(true)
      return
    }
    onUpdateNode(node.id, {
      label,
      description: draftDescription.trim(),
      nodeType: draftType,
      status: draftStatus,
      ownerId: draftOwnerId || undefined,
    })
    setEditing(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    if (editing) {
      setEditing(false)
    } else if (confirmingDelete) {
      setConfirmingDelete(false)
    } else {
      onClose()
    }
  }

  const needsDefinition = data.status === 'needs-definition'
  const shape = shapeFor(data.nodeType, data.shape)
  const fieldId = (name: string) => `node-panel-${node.id}-${name}`

  return (
    <aside
      className="node-panel"
      aria-labelledby="node-panel-heading"
      onKeyDown={handleKeyDown}
    >
      <header className="node-panel__header">
        <div className="node-panel__title-group">
          <p className="node-panel__eyebrow">
            {labelFor(SHAPE_OPTIONS, shape)} · {data.lane ?? data.group}
          </p>
          <h2
            id="node-panel-heading"
            className="node-panel__title"
            ref={headingRef}
            tabIndex={-1}
          >
            {data.label}
          </h2>
        </div>
        <button
          type="button"
          className="node-panel__close"
          onClick={onClose}
          aria-label="Close node details"
        >
          ×
        </button>
      </header>

      {editing ? (
        <form className="node-panel__form" onSubmit={handleSave} noValidate>
          <label className="node-panel__field" htmlFor={fieldId('label')}>
            <span className="node-panel__field-label">Label</span>
            <input
              id={fieldId('label')}
              className="node-panel__input"
              type="text"
              value={draftLabel}
              onChange={(event) => {
                setDraftLabel(event.target.value)
                if (showLabelError) setShowLabelError(false)
              }}
              aria-invalid={showLabelError}
              aria-describedby={showLabelError ? fieldId('label-error') : undefined}
              required
            />
            {showLabelError && (
              <span
                id={fieldId('label-error')}
                className="node-panel__error"
                role="alert"
              >
                A label is required.
              </span>
            )}
          </label>

          <label className="node-panel__field" htmlFor={fieldId('description')}>
            <span className="node-panel__field-label">Description</span>
            <textarea
              id={fieldId('description')}
              className="node-panel__textarea"
              rows={5}
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>

          <label className="node-panel__field" htmlFor={fieldId('type')}>
            <span className="node-panel__field-label">Type</span>
            <select
              id={fieldId('type')}
              className="node-panel__select"
              value={draftType}
              onChange={(event) =>
                setDraftType(event.target.value as WorkflowNodeType)
              }
            >
              {NODE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="node-panel__field" htmlFor={fieldId('owner')}>
            <span className="node-panel__field-label">Owner</span>
            <select
              id={fieldId('owner')}
              className="node-panel__select"
              value={draftOwnerId}
              onChange={(event) => setDraftOwnerId(event.target.value)}
            >
              <option value="">No owner</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))}
              {draftOwnerId && !members.some((member) => member.id === draftOwnerId) && (
                <option value={draftOwnerId}>Unknown member ({draftOwnerId})</option>
              )}
            </select>
          </label>

          <label className="node-panel__field" htmlFor={fieldId('status')}>
            <span className="node-panel__field-label">Status</span>
            <select
              id={fieldId('status')}
              className="node-panel__select"
              value={draftStatus}
              onChange={(event) =>
                setDraftStatus(event.target.value as WorkflowNodeStatus)
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="node-panel__actions">
            <button
              type="submit"
              className="node-panel__button node-panel__button--primary"
            >
              Save changes
            </button>
            <button
              type="button"
              className="node-panel__button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="node-panel__details">
            <div className="node-panel__detail">
              <dt>What this step does</dt>
              <dd>
                {data.description ? (
                  <p className="node-panel__description">{data.description}</p>
                ) : (
                  <span className="node-panel__muted">No description yet.</span>
                )}
              </dd>
            </div>
            <div className="node-panel__detail">
              <dt>Owner</dt>
              <dd>
                {data.ownerId ? (
                  owner ? (
                    <Link
                      className="node-panel__owner-link"
                      to={{ pathname: '/team', hash: owner.id }}
                    >
                      {owner.name}
                      <span className="node-panel__muted"> · {owner.role}</span>
                    </Link>
                  ) : (
                    <span className="node-panel__muted">
                      Unknown member ({data.ownerId})
                    </span>
                  )
                ) : (
                  <span className="node-panel__muted">
                    {data.ownerLabel ?? 'No owner assigned.'}
                  </span>
                )}
              </dd>
            </div>
            <div className="node-panel__detail">
              <dt>Lane</dt>
              <dd>{data.lane ?? data.group}</dd>
            </div>
            <div className="node-panel__detail">
              <dt>Shape</dt>
              <dd>{labelFor(SHAPE_OPTIONS, shape)}</dd>
            </div>
            <div className="node-panel__detail">
              <dt>Status</dt>
              <dd>
                <span
                  className={
                    needsDefinition
                      ? 'node-panel__status node-panel__status--needs-definition'
                      : 'node-panel__status'
                  }
                >
                  {labelFor(STATUS_OPTIONS, data.status)}
                </span>
              </dd>
            </div>
          </dl>

          <div className="node-panel__actions">
            <button
              type="button"
              className="node-panel__button node-panel__button--primary"
              onClick={startEditing}
            >
              Edit node
            </button>
            {confirmingDelete ? (
              <span
                className="node-panel__confirm"
                role="group"
                aria-label="Confirm node deletion"
              >
                <button
                  type="button"
                  className="node-panel__button node-panel__button--danger"
                  onClick={() => onDeleteNode(node.id)}
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  className="node-panel__button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="node-panel__button node-panel__button--danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete node
              </button>
            )}
          </div>
          {confirmingDelete && (
            <p className="node-panel__warning" role="status">
              Deleting this node also removes its {connected.length}{' '}
              {connected.length === 1 ? 'connection' : 'connections'}.
            </p>
          )}
        </>
      )}

      <section className="node-panel__section" aria-labelledby="node-panel-edges-heading">
        <h3 id="node-panel-edges-heading" className="node-panel__section-title">
          Connections ({connected.length})
        </h3>
        {connected.length === 0 ? (
          <p className="node-panel__muted">
            This node has no connections. Drag from one node handle to another to add one.
          </p>
        ) : (
          <ul className="node-panel__edges">
            {connected.map((edge) => {
              const outgoing = edge.source === node.id
              return (
                <EdgeRow
                  key={edge.id}
                  edge={edge}
                  direction={outgoing ? 'outgoing' : 'incoming'}
                  otherLabel={nodeLabelById(outgoing ? edge.target : edge.source)}
                  onUpdate={onUpdateEdge}
                  onDelete={onDeleteEdge}
                />
              )
            })}
          </ul>
        )}
      </section>
    </aside>
  )
}

/**
 * Side panel for the selected workflow node. Shows its description, owner
 * (linked to the Team page) and status, and lets the user edit or delete the
 * node and edit or delete the edges connected to it. All changes are reported
 * through callbacks; the parent owns the graph state and persists it.
 */
export function NodeDetailsPanel({ node, ...rest }: NodeDetailsPanelProps) {
  if (!node) return null
  return <NodeDetails key={node.id} node={node} {...rest} />
}