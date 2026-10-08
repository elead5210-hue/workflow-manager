import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMembers, useWorkflow } from '../../data/hooks'
import { createExportFileName } from '../../data/exportImport'
import { downloadTextFile, readFileAsText } from './fileTransfer'
import SnapshotHistory from './SnapshotHistory'
import './DataPage.css'

/** A file that was read and is waiting for the user to confirm the import. */
interface PendingImport {
  fileName: string
  text: string
}

/** The message shown after an export or import finishes or fails. */
type Notice =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string; details?: string[] }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

/** A readable local date and time, or a dash when there is none. */
function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso
  return new Date(time).toLocaleString()
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * The data page: export the workflow and the team members to a JSON file, import
 * such a file again, see which version of the workflow is current, and manage the
 * history of saved snapshots.
 */
export default function DataPage() {
  const { status, error, workflow, exportData, importData, reload } = useWorkflow()
  const { members } = useMembers()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  function handleExport() {
    try {
      downloadTextFile(createExportFileName(), exportData())
      setNotice({
        kind: 'success',
        text: 'The workflow and team members were exported to a JSON file.',
      })
    } catch (caught) {
      setNotice({ kind: 'error', text: `The export failed. ${errorMessage(caught)}` })
    }
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const file = input.files?.[0]
    // Clearing the value lets the same file be chosen again after a cancel or a failure.
    input.value = ''
    if (!file) return

    setNotice(null)
    setPending(null)
    try {
      const text = await readFileAsText(file)
      setPending({ fileName: file.name, text })
    } catch (caught) {
      setNotice({ kind: 'error', text: errorMessage(caught) })
    }
  }

  async function handleConfirmImport() {
    if (!pending || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await importData(pending.text)
      if (result.ok) {
        const workflowText = result.workflowReplaced
          ? 'The workflow was replaced; the previous one is saved as a snapshot.'
          : 'The file had no workflow, so the current workflow was kept.'
        setNotice({
          kind: 'success',
          text: `Imported ${pluralize(result.memberCount, 'team member')} from ${pending.fileName}. ${workflowText}`,
        })
      } else {
        setNotice({
          kind: 'error',
          text: `${pending.fileName} could not be imported. Nothing was changed.`,
          details: result.errors,
        })
      }
      setPending(null)
    } catch (caught) {
      setNotice({ kind: 'error', text: `The import failed. ${errorMessage(caught)}` })
    } finally {
      setBusy(false)
    }
  }

  function handleCancelImport() {
    if (busy) return
    setPending(null)
  }

  if (status === 'loading') {
    return (
      <section className="data-page" aria-labelledby="data-page-title">
        <h1 id="data-page-title" className="data-page__title">
          Data
        </h1>
        <p className="data-page__status" role="status">
          Loading data...
        </p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="data-page" aria-labelledby="data-page-title">
        <h1 id="data-page-title" className="data-page__title">
          Data
        </h1>
        <div className="data-page__status data-page__status--error" role="alert">
          <p>{error ?? 'The data could not be loaded.'}</p>
          <button type="button" className="data-page__button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="data-page" aria-labelledby="data-page-title">
      <header className="data-page__header">
        <h1 id="data-page-title" className="data-page__title">
          Data
        </h1>
        <p className="data-page__intro">
          Back up, share and restore the workflow and the team, and keep earlier versions of the
          process.
        </p>
      </header>

      <section className="data-page__panel" aria-labelledby="data-page-version-title">
        <h2 id="data-page-version-title" className="data-page__panel-title">
          Current workflow
        </h2>
        {workflow ? (
          <dl className="data-page__facts">
            <div className="data-page__fact">
              <dt>Name</dt>
              <dd>{workflow.name}</dd>
            </div>
            <div className="data-page__fact">
              <dt>Version</dt>
              <dd>{workflow.version}</dd>
            </div>
            <div className="data-page__fact">
              <dt>Last updated</dt>
              <dd>{formatDate(workflow.updatedAt)}</dd>
            </div>
            <div className="data-page__fact">
              <dt>Contents</dt>
              <dd>
                {pluralize(workflow.nodes.length, 'node')},{' '}
                {pluralize(workflow.edges.length, 'edge')},{' '}
                {pluralize(members.length, 'team member')}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="data-page__muted">
            There is no workflow stored yet. {pluralize(members.length, 'team member')} will
            still be exported.
          </p>
        )}
      </section>

      <section className="data-page__panel" aria-labelledby="data-page-transfer-title">
        <h2 id="data-page-transfer-title" className="data-page__panel-title">
          Export and import
        </h2>
        <p className="data-page__muted">
          The export file holds the workflow and the team members. Importing a file replaces
          the current team members and, when the file has one, the workflow.
        </p>

        <div className="data-page__actions">
          <button type="button" className="data-page__button" onClick={handleExport}>
            Export to file
          </button>
          <button
            type="button"
            className="data-page__button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Import from file
          </button>
          <input
            ref={fileInputRef}
            className="data-page__file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleFileChosen(event)}
            aria-label="Choose a JSON export file to import"
            tabIndex={-1}
            hidden
          />
        </div>

        {pending ? (
          <div className="data-page__confirm" role="alertdialog" aria-label="Confirm import">
            <p className="data-page__confirm-text">
              Import <strong>{pending.fileName}</strong>? This replaces the current team members
              and, when the file has a workflow, the current workflow. The workflow being
              replaced is saved as a snapshot first.
            </p>
            <div className="data-page__actions">
              <button
                type="button"
                className="data-page__button data-page__button--primary"
                onClick={() => void handleConfirmImport()}
                disabled={busy}
              >
                {busy ? 'Importing...' : 'Import'}
              </button>
              <button
                type="button"
                className="data-page__button"
                onClick={handleCancelImport}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div
            className={
              notice.kind === 'error'
                ? 'data-page__notice data-page__notice--error'
                : 'data-page__notice data-page__notice--success'
            }
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            <p>{notice.text}</p>
            {notice.kind === 'error' && notice.details && notice.details.length > 0 ? (
              <ul className="data-page__problems">
                {notice.details.map((problem, index) => (
                  <li key={`${index}-${problem}`}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="data-page__panel" aria-labelledby="data-page-history-title">
        <h2 id="data-page-history-title" className="data-page__panel-title">
          Snapshot history
        </h2>
        <SnapshotHistory />
      </section>
    </section>
  )
}