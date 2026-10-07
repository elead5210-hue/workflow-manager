import { useCallback, useEffect, useState } from 'react'
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getWorkflow } from '../../db'
import { SEED_WORKFLOW_ID } from '../../db/seedWorkflow'
import { mapWorkflowToFlow } from './flowMapping'
import type { FlowGraph } from './flowMapping'
import { nodeTypes } from './WorkflowNodes'
import './WorkflowPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: FlowGraph }

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

export default function WorkflowPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // The flag stops a stale load (unmount or StrictMode re-run) from updating state.
    let cancelled = false
    setState({ status: 'loading' })

    getWorkflow(SEED_WORKFLOW_ID)
      .then((workflow) => {
        if (cancelled) return
        if (!workflow || workflow.nodes.length === 0) {
          setState({ status: 'empty' })
          return
        }
        setState({ status: 'ready', graph: mapWorkflowToFlow(workflow) })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        setState({ status: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  return (
    <section className="workflow-page" aria-labelledby="workflow-heading">
      <div className="workflow-page__header">
        <h1 id="workflow-heading">Workflow</h1>
        <p className="workflow-page__hint">
          Scroll to zoom, drag the background to pan. Dashed red outlines mark
          areas that still need definition.
        </p>
      </div>

      {state.status === 'loading' ? (
        <div className="workflow-page__state" role="status" aria-live="polite">
          <div className="workflow-page__spinner" aria-hidden="true" />
          <p className="workflow-page__state-title">Loading workflow</p>
          <p className="workflow-page__state-text">
            Reading the workflow from local storage.
          </p>
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <div className="workflow-page__state" role="status">
          <p className="workflow-page__state-title">No workflow yet</p>
          <p className="workflow-page__state-text">
            There is no workflow stored in this browser. Once seed data or
            workflow nodes exist they will be drawn here.
          </p>
          <button
            type="button"
            className="workflow-page__state-action"
            onClick={retry}
          >
            Reload
          </button>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div
          className="workflow-page__state workflow-page__state--error"
          role="alert"
        >
          <p className="workflow-page__state-title">
            The workflow could not be loaded
          </p>
          <p className="workflow-page__state-text">{state.message}</p>
          <button
            type="button"
            className="workflow-page__state-action"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <div
          className="workflow-page__canvas"
          role="region"
          aria-label="Workflow diagram"
        >
          <ReactFlow
            nodes={state.graph.nodes}
            edges={state.graph.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
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
      ) : null}
    </section>
  )
}