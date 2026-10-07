import type { WorkflowEdgeKind, WorkflowNodeType } from '../../types'

interface NodeTypeEntry {
  type: WorkflowNodeType
  label: string
  description: string
}

interface EdgeKindEntry {
  kind: WorkflowEdgeKind
  label: string
  description: string
}

const NODE_TYPE_ENTRIES: NodeTypeEntry[] = [
  {
    type: 'actor',
    label: 'Actor',
    description: 'A person or team role who does the work.',
  },
  {
    type: 'system',
    label: 'System',
    description: 'An app or service that takes part in the process.',
  },
  {
    type: 'process',
    label: 'Process',
    description: 'A step or activity in the workflow.',
  },
  {
    type: 'artifact',
    label: 'Artifact',
    description: 'Something that is produced or passed on, such as a roadmap or a file.',
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'A point where the flow can go different ways.',
  },
]

const EDGE_KIND_ENTRIES: EdgeKindEntry[] = [
  {
    kind: 'data',
    label: 'Data',
    description: 'Information or files move from one node to the next.',
  },
  {
    kind: 'handoff',
    label: 'Handoff',
    description: 'Work is passed from one owner or system to another.',
  },
  {
    kind: 'trigger',
    label: 'Trigger',
    description: 'Something that happens in one node starts the next one.',
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
            Node types
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
            Connection types
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