import type { WorkflowEdgeStyle, WorkflowNodeShape } from '../../types'

interface NodeTypeEntry {
  /** The node shape of the example workflow. It also names the swatch class. */
  type: WorkflowNodeShape
  label: string
  description: string
}

interface EdgeKindEntry {
  /** The line style of the example workflow. It also names the line class. */
  kind: WorkflowEdgeStyle
  label: string
  description: string
}

const NODE_TYPE_ENTRIES: NodeTypeEntry[] = [
  {
    type: 'terminal',
    label: 'Start / end',
    description: 'Where a request enters the workflow or where it finishes.',
  },
  {
    type: 'process',
    label: 'Process',
    description: 'A step or activity in the workflow.',
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'A point where the flow can go different ways.',
  },
  {
    type: 'artifact',
    label: 'Artifact',
    description: 'Something that is produced or passed on, such as a roadmap or a file.',
  },
]

const EDGE_KIND_ENTRIES: EdgeKindEntry[] = [
  {
    kind: 'flow',
    label: 'Flow',
    description: 'The normal path from one step to the next.',
  },
  {
    kind: 'feedback',
    label: 'Feedback',
    description: 'A dashed line that sends a result back to an earlier step.',
  },
  {
    kind: 'failure',
    label: 'Failure',
    description: 'A dashed line taken when a step fails or something breaks.',
  },
]

/**
 * Explains the node types, the needs-definition marker and the edge kinds drawn on
 * the workflow diagram. Meaning is carried by the text and by the line style as well
 * as by colour, so the legend does not rely on colour alone.
 */
export function WorkflowLegend() {
  return (
    <details className="workflow-legend" open>
      <summary className="workflow-legend__summary">Legend</summary>

      <div className="workflow-legend__body">
        <section className="workflow-legend__group" aria-labelledby="legend-nodes-heading">
          <h2 id="legend-nodes-heading" className="workflow-legend__title">
            Node shapes
          </h2>
          <ul className="workflow-legend__list">
            {NODE_TYPE_ENTRIES.map((entry) => (
              <li key={entry.type} className="workflow-legend__item">
                <span
                  className={`workflow-legend__swatch workflow-legend__swatch--${entry.type}`}
                  aria-hidden="true"
                />
                <span className="workflow-legend__text">
                  <strong className="workflow-legend__name">{entry.label}.</strong>{' '}
                  {entry.description}
                </span>
              </li>
            ))}
            <li className="workflow-legend__item">
              <span
                className="workflow-legend__swatch workflow-legend__swatch--needs-definition"
                aria-hidden="true"
              />
              <span className="workflow-legend__text">
                <strong className="workflow-legend__name">Needs definition.</strong> A dashed
                red outline marks a node that is still vague and needs to be clarified with
                the team.
              </span>
            </li>
          </ul>
        </section>

        <section className="workflow-legend__group" aria-labelledby="legend-edges-heading">
          <h2 id="legend-edges-heading" className="workflow-legend__title">
            Line styles
          </h2>
          <ul className="workflow-legend__list">
            {EDGE_KIND_ENTRIES.map((entry) => (
              <li key={entry.kind} className="workflow-legend__item">
                <svg
                  className="workflow-legend__line-sample"
                  viewBox="0 0 40 8"
                  width="40"
                  height="8"
                  aria-hidden="true"
                  focusable="false"
                >
                  <line
                    className={`workflow-legend__line workflow-legend__line--${entry.kind}`}
                    x1="2"
                    y1="4"
                    x2="38"
                    y2="4"
                  />
                </svg>
                <span className="workflow-legend__text">
                  <strong className="workflow-legend__name">{entry.label}.</strong>{' '}
                  {entry.description}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  )
}