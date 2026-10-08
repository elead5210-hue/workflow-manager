import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react'
import type {
  Connection,
  EdgeChange,
  NodeChange,
  ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMembers, useWorkflow } from '../../data/hooks'
import type { TeamMember, Workflow } from '../../types'
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  createFlowEdge,
  createUniqueId,
  isWorkflowCardNode,
  mapFlowToWorkflow,
  mapWorkflowToFlow,
} from './flowMapping'
import type { WorkflowFlowEdge, WorkflowFlowNode } from './flowMapping'
import { NodeDetailsPanel } from './NodeDetailsPanel'
import type { EdgeChanges, NodeChanges } from './NodeDetailsPanel'
import { WorkflowLegend } from './WorkflowLegend'
import { nodeTypes } from './WorkflowNodes'
import './WorkflowPage.css'

/** Colours used by the minimap, matching the node accents in WorkflowPage.css. */
const MINIMAP_COLORS: Record<string, string> = {
  actor: '#e8590c',
  system: '#3b5bdb',
  process: '#2f9e44',
  artifact: '#9c36b5',
  decision: '#f08c00',
  swimlane: 'transparent',
}

const FIT_VIEW_OPTIONS = { padding: 0.15 }

function minimapNodeColor(node: { type?: string }): string {
  return MINIMAP_COLORS[node.type ?? ''] ?? '#868e96'
}

/** Group given to nodes that are added while no node is selected. */
const NEW_NODE_GROUP = 'Unassigned'

type SaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'error'; message: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

/**
 * Rebuilds the swimlane background nodes from the current workflow nodes so the
 * lanes follow nodes that were moved, added or deleted. Workflow nodes are kept as they are.
 */
function withFreshSwimlanes(
  base: Workflow,
  current: WorkflowFlowNode[],
): WorkflowFlowNode[] {
  const lanes = mapWorkflowToFlow(mapFlowToWorkflow(base, current, [])).nodes.filter(
    (node) => !isWorkflowCardNode(node),
  )
  return [...lanes, ...current.filter(isWorkflowCardNode)]
}

interface WorkflowEditorProps {
  workflow: Workflow
  members: TeamMember[]
  /** Id of the node to select when the editor first opens (from the `node` URL query), or null. */
  initialNodeId: string | null
  /** Clears and reseeds the stored workflow, then reloads the page data. */
  onReset: () => Promise<void>
}

/**
 * The editable diagram: owns the React Flow state, shows the details panel for
 * the selected node and saves every change to IndexedDB.
 */
function WorkflowEditor({
  workflow: sharedWorkflow,
  members,
  initialNodeId,
  onReset,
}: WorkflowEditorProps) {
  // The editor owns the diagram state, so it keeps the workflow it was opened with as its
  // base. Its own saves update the shared workflow, which must not restart the save effect.
  const [workflow] = useState(sharedWorkflow)
  const { saveWorkflow } = useWorkflow()
  const [initial] = useState(() => {
    const graph = mapWorkflowToFlow(workflow)
    if (!initialNodeId) return graph
    // Select the linked node so its details panel is open as soon as the diagram appears.
    return {
      ...graph,
      nodes: graph.nodes.map(
        (node): WorkflowFlowNode =>
          isWorkflowCardNode(node) && node.id === initialNodeId
            ? { ...node, selected: true }
            : node,
      ),
    }
  })
  const [nodes, setNodes] = useState<WorkflowFlowNode[]>(initial.nodes)
  const [edges, setEdges] = useState<WorkflowFlowEdge[]>(initial.edges)
  const [revision, setRevision] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' })
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const latestRevision = useRef(0)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const flowRef = useRef<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(
    null,
  )
  const canvasRef = useRef<HTMLDivElement>(null)

  // Keep refs pointing at the latest graph so the save effect never reads stale state.
  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  })

  // Persist the whole workflow after each completed change. Saves run one after another.
  useEffect(() => {
    if (revision === 0) return
    latestRevision.current = revision
    const snapshot = mapFlowToWorkflow(workflow, nodesRef.current, edgesRef.current)
    setSaveStatus({ state: 'saving' })
    saveQueue.current = saveQueue.current
      .then(() => saveWorkflow(snapshot))
      .then(() => {
        if (latestRevision.current === revision) setSaveStatus({ state: 'saved' })
      })
      .catch((error: unknown) => {
        setSaveStatus({ state: 'error', message: errorMessage(error) })
      })
  }, [revision, workflow, saveWorkflow])

  const markChanged = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  const selectedNode = useMemo(() => {
    const selected = nodes.filter(isWorkflowCardNode).filter((node) => node.selected)
    return selected.length === 1 ? selected[0] : null
  }, [nodes])

  const hasSelection = useMemo(() => nodes.some((node) => node.selected), [nodes])

  // While a step is selected, every step and line that is not that step or directly
  // connected to it is dimmed, as in the example workflow. The stored graph state is
  // left alone: only the copies handed to React Flow carry the extra class names.
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!selectedNode) return { displayNodes: nodes, displayEdges: edges }
    const connectedEdgeIds = new Set<string>()
    const connectedNodeIds = new Set<string>([selectedNode.id])
    for (const edge of edges) {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        connectedEdgeIds.add(edge.id)
        connectedNodeIds.add(edge.source)
        connectedNodeIds.add(edge.target)
      }
    }
    const dimmedNodes = nodes.map((node): WorkflowFlowNode => {
      if (!isWorkflowCardNode(node)) return node
      return {
        ...node,
        className: connectedNodeIds.has(node.id) ? 'is-highlighted' : 'is-dimmed',
      }
    })
    const dimmedEdges = edges.map(
      (edge): WorkflowFlowEdge => ({
        ...edge,
        className: `${edge.className ?? ''} ${
          connectedEdgeIds.has(edge.id) ? 'is-highlighted' : 'is-dimmed'
        }`.trim(),
      }),
    )
    return { displayNodes: dimmedNodes, displayEdges: dimmedEdges }
  }, [nodes, edges, selectedNode])

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current))
    },
    [],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowFlowEdge>[]) => {
      setEdges((current) => applyEdgeChanges(changes, current))
    },
    [],
  )

  const handleNodeDragStop = useCallback(() => {
    setNodes((current) => withFreshSwimlanes(workflow, current))
    markChanged()
  }, [workflow, markChanged])

  const handleNodesDelete = useCallback(() => {
    setNodes((current) => withFreshSwimlanes(workflow, current))
    markChanged()
  }, [workflow, markChanged])

  const handleEdgesDelete = useCallback(() => {
    markChanged()
  }, [markChanged])

  const handleConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection
      if (!source || !target || source === target) return
      setEdges((current) => {
        if (current.some((edge) => edge.source === source && edge.target === target)) {
          return current
        }
        const id = createUniqueId(
          'edge',
          current.map((edge) => edge.id),
        )
        return [...current, createFlowEdge(id, source, target, 'data')]
      })
      markChanged()
    },
    [markChanged],
  )

  const handleAddNode = useCallback(() => {
    let position = { x: 0, y: 0 }
    if (selectedNode) {
      position = {
        x: selectedNode.position.x + NODE_WIDTH + 60,
        y: selectedNode.position.y + NODE_HEIGHT + 40,
      }
    } else {
      const bounds = canvasRef.current?.getBoundingClientRect()
      const flow = flowRef.current
      if (bounds && flow) {
        const center = flow.screenToFlowPosition({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        })
        position = { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 }
      }
    }
    const group = selectedNode ? selectedNode.data.group : NEW_NODE_GROUP

    setNodes((current) => {
      const id = createUniqueId(
        'node',
        current.map((node) => node.id),
      )
      const created: WorkflowFlowNode = {
        id,
        type: 'process',
        position,
        data: {
          label: 'New step',
          description: '',
          nodeType: 'process',
          status: 'needs-definition',
          group,
        },
        zIndex: 1,
        selected: true,
      }
      const deselected = current.map(
        (node): WorkflowFlowNode =>
          node.selected ? { ...node, selected: false } : node,
      )
      return withFreshSwimlanes(workflow, [...deselected, created])
    })
    markChanged()
  }, [selectedNode, workflow, markChanged])

  const handleClosePanel = useCallback(() => {
    setNodes((current) =>
      current.map(
        (node): WorkflowFlowNode =>
          node.selected ? { ...node, selected: false } : node,
      ),
    )
  }, [])

  const handleUpdateNode = useCallback(
    (id: string, changes: NodeChanges) => {
      setNodes((current) =>
        current.map((node): WorkflowFlowNode => {
          if (node.id !== id || !isWorkflowCardNode(node)) return node
          // Keep the lane, column, owner name and shape of the example workflow.
          const data = {
            ...node.data,
            label: changes.label,
            description: changes.description,
            nodeType: changes.nodeType,
            status: changes.status,
          }
          if (changes.ownerId) {
            data.ownerId = changes.ownerId
          } else {
            delete data.ownerId
          }
          return { ...node, type: changes.nodeType, data }
        }),
      )
      markChanged()
    },
    [markChanged],
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((current) =>
        withFreshSwimlanes(
          workflow,
          current.filter((node) => node.id !== id),
        ),
      )
      setEdges((current) =>
        current.filter((edge) => edge.source !== id && edge.target !== id),
      )
      markChanged()
    },
    [workflow, markChanged],
  )

  const handleUpdateEdge = useCallback(
    (id: string, changes: EdgeChanges) => {
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? {
                ...createFlowEdge(
                  id,
                  edge.source,
                  edge.target,
                  changes.kind,
                  changes.label,
                  changes.style,
                ),
                selected: edge.selected,
              }
            : edge,
        ),
      )
      markChanged()
    },
    [markChanged],
  )

  const handleDeleteEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id))
      markChanged()
    },
    [markChanged],
  )

  const handleConfirmReset = useCallback(async () => {
    setResetting(true)
    setResetError(null)
    try {
      // Let any pending save finish first so it cannot land after the reset.
      await saveQueue.current
      await onReset()
    } catch (error) {
      setResetting(false)
      setConfirmingReset(false)
      setResetError(errorMessage(error))
    }
  }, [onReset])

  let statusText = ''
  let statusIsError = false
  if (resetError) {
    statusText = `Could not reset the workflow: ${resetError}`
    statusIsError = true
  } else if (saveStatus.state === 'saving') {
    statusText = 'Saving changes...'
  } else if (saveStatus.state === 'saved') {
    statusText = 'All changes saved.'
  } else if (saveStatus.state === 'error') {
    statusText = `Could not save changes: ${saveStatus.message}`
    statusIsError = true
  }

  return (
    <div className="workflow-editor">
      <div
        className="workflow-toolbar"
        role="toolbar"
        aria-label="Workflow editing tools"
      >
        <button
          type="button"
          className="workflow-toolbar__button workflow-toolbar__button--primary"
          onClick={handleAddNode}
        >
          Add node
        </button>
        <button
          type="button"
          className="workflow-toolbar__button"
          onClick={handleClosePanel}
          disabled={!hasSelection}
        >
          Clear selection
        </button>
        {confirmingReset ? (
          <span
            className="workflow-toolbar__confirm"
            role="group"
            aria-label="Confirm reset to seed data"
          >
            <span className="workflow-toolbar__confirm-text">
              Replace the workflow with the seed data? Your changes to the
              workflow will be lost.
            </span>
            <button
              type="button"
              className="workflow-toolbar__button workflow-toolbar__button--danger"
              onClick={() => void handleConfirmReset()}
              disabled={resetting}
            >
              {resetting ? 'Resetting...' : 'Confirm reset'}
            </button>
            <button
              type="button"
              className="workflow-toolbar__button"
              onClick={() => setConfirmingReset(false)}
              disabled={resetting}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="workflow-toolbar__button"
            onClick={() => {
              setResetError(null)
              setConfirmingReset(true)
            }}
          >
            Reset to seed data
          </button>
        )}
        <p
          className={
            statusIsError
              ? 'workflow-toolbar__status workflow-toolbar__status--error'
              : 'workflow-toolbar__status'
          }
          role="status"
          aria-live="polite"
        >
          {statusText}
        </p>
      </div>

      <div className="workflow-editor__body">
        <div
          className="workflow-page__canvas"
          role="region"
          aria-label="Workflow diagram. Drag a node to move it. Select a node to open its details and dim the steps that are not connected to it."
          ref={canvasRef}
        >
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onPaneClick={handleClosePanel}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeDragStop={handleNodeDragStop}
            onNodesDelete={handleNodesDelete}
            onEdgesDelete={handleEdgesDelete}
            onInit={(instance) => {
              flowRef.current = instance
            }}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} />
            <Controls showInteractive={false} fitViewOptions={FIT_VIEW_OPTIONS} />
            <MiniMap
              pannable
              zoomable
              nodeColor={minimapNodeColor}
              nodeStrokeWidth={2}
              ariaLabel="Workflow minimap"
            />
          </ReactFlow>
        </div>

        <NodeDetailsPanel
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          members={members}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onUpdateEdge={handleUpdateEdge}
          onDeleteEdge={handleDeleteEdge}
          onClose={handleClosePanel}
        />
      </div>
    </div>
  )
}

export default function WorkflowPage() {
  const { status, error, workflow, resetWorkflow, reload } = useWorkflow()
  const { members } = useMembers()
  // Changing this key remounts the editor so it starts again from the reseeded workflow.
  const [editorKey, setEditorKey] = useState(0)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const initialNodeId = searchParams.get('node')

  const retry = useCallback(() => {
    void reload()
  }, [reload])

  /** Clears and reseeds the workflow store, then remounts the editor so it shows the seed data. */
  const resetToSeed = useCallback(async () => {
    await resetWorkflow()
    setEditorKey((key) => key + 1)
  }, [resetWorkflow])

  const restoreSeed = useCallback(() => {
    setRestoreError(null)
    resetToSeed().catch((error: unknown) => {
      setRestoreError(errorMessage(error))
    })
  }, [resetToSeed])

  return (
    <section className="workflow-page" aria-labelledby="workflow-heading">
      <div className="workflow-page__header">
        <h1 id="workflow-heading">
          Company workflow{' '}
          <span className="workflow-page__subtitle">// closed loop</span>
        </h1>
        <p className="workflow-page__hint">
          Every request enters at its start, runs through its lane and ends at
          done. Select a step to see what it does: the steps and lines that are
          not connected to it dim, and Clear selection brings them back. Scroll
          to zoom, drag the background to pan and drag a node to move it. Dashed
          red outlines mark areas that still need definition.
        </p>
      </div>

      {status === 'loading' ? (
        <div className="workflow-page__state" role="status" aria-live="polite">
          <div className="workflow-page__spinner" aria-hidden="true" />
          <p className="workflow-page__state-title">Loading workflow</p>
          <p className="workflow-page__state-text">
            Reading the workflow from local storage.
          </p>
        </div>
      ) : null}

      {status === 'ready' && !workflow ? (
        <div className="workflow-page__state" role="status">
          <p className="workflow-page__state-title">No workflow yet</p>
          <p className="workflow-page__state-text">
            There is no workflow stored in this browser. Once seed data or
            workflow nodes exist they will be drawn here.
          </p>
          {restoreError ? (
            <p className="workflow-page__state-text" role="alert">
              Could not restore the seed data: {restoreError}
            </p>
          ) : null}
          <button
            type="button"
            className="workflow-page__state-action"
            onClick={retry}
          >
            Reload
          </button>
          <button
            type="button"
            className="workflow-page__state-action"
            onClick={restoreSeed}
          >
            Restore seed data
          </button>
        </div>
      ) : null}

      {status === 'error' ? (
        <div
          className="workflow-page__state workflow-page__state--error"
          role="alert"
        >
          <p className="workflow-page__state-title">
            The workflow could not be loaded
          </p>
          <p className="workflow-page__state-text">{error}</p>
          <button
            type="button"
            className="workflow-page__state-action"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      ) : null}

      {status === 'ready' && workflow ? (
        <>
          <WorkflowLegend />
          <WorkflowEditor
            key={editorKey}
            workflow={workflow}
            members={members}
            initialNodeId={initialNodeId}
            onReset={resetToSeed}
          />
        </>
      ) : null}
    </section>
  )
}