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
]

export interface WorkflowLegendProps {
  /** Clears the selected step. When omitted, the 'clear selection' button is not shown. */
  onClearSelection?: () => void
  /** True while a step is selected. The 'clear selection' button is disabled otherwise. */
  hasSelection?: boolean
}

/**
 * Inline legend drawn above the workflow diagram, as in the example: one row with a swatch for
 * each node shape, a line sample for each line style, the needs-definition marker and a
 * 'clear selection' button. Each entry also has a text label, so meaning does not rely on
 * colour alone. The longer description of an entry is shown as its tooltip.
 */
export function WorkflowLegend({
  onClearSelection,
  hasSelection = false,
}: WorkflowLegendProps) {
  return (
    <div className="workflow-legend" role="group" aria-label="Legend">
      <ul className="workflow-legend__items">
        {NODE_TYPE_ENTRIES.map((entry) => (
          <li
            key={entry.type}
            className="workflow-legend__item"
            title={entry.description}
          >
            <span
              className={`workflow-legend__swatch workflow-legend__swatch--${entry.type}`}
              aria-hidden="true"
            />
            <span className="workflow-legend__text">{entry.label}</span>
          </li>
        ))}
        {EDGE_KIND_ENTRIES.map((entry) => (
          <li
            key={entry.kind}
            className="workflow-legend__item"
            title={entry.description}
          >
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
            <span className="workflow-legend__text">{entry.label}</span>
          </li>
        ))}
        <li
          className="workflow-legend__item"
          title="A dashed red outline marks a node that is still vague and needs to be clarified with the team."
        >
          <span
            className="workflow-legend__swatch workflow-legend__swatch--needs-definition"
            aria-hidden="true"
          />
          <span className="workflow-legend__text">Needs definition</span>
        </li>
      </ul>
      {onClearSelection ? (
        <button
          type="button"
          className="workflow-legend__clear"
          onClick={onClearSelection}
          disabled={!hasSelection}
        >
          clear selection
        </button>
      ) : null}
    </div>
  )
}