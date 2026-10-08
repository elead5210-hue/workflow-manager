import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSnapshots } from '../../data/hooks'
import { diffWorkflows, hasChanges, summarizeDiff } from '../../data/snapshotDiff'
import type { WorkflowDiff } from '../../data/snapshotDiff'
import type { WorkflowEdge, WorkflowSnapshot } from '../../types'

/** A step that is waiting for the user to confirm it. */
type PendingAction = { kind: 'restore' | 'delete'; id: string }

/** The message shown after an action finishes or fails. */
type Notice = { kind: 'success' | 'error'; text: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

/** A readable local date and time, or the original text when it is not a valid date. */
function formatDate(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso
  return new Date(time).toLocaleString()
}

/** A name for an edge in the comparison: its label, or the two nodes it joins. */
function edgeName(edge: WorkflowEdge): string {
  return edge.label ? edge.label : `${edge.source} to ${edge.target}`
}

interface DiffDetailsProps {
  diff: WorkflowDiff
}

/** The full list of differences between a snapshot and the current workflow. */
function DiffDetails({ diff }: DiffDetailsProps) {
  if (!hasChanges(diff)) {
    return (
      <p className="snapshot-history__muted">
        This snapshot is the same as the current workflow.
      </p>
    )
  }

  return (
    <div className="snapshot-history__diff-body">
      {diff.nameChange ? (
        <p className="snapshot-history__diff-line">
          Workflow renamed from <strong>{diff.nameChange.before}</strong> to{' '}
          <strong>{diff.nameChange.after}</strong>.
        </p>
      ) : null}

      {diff.nodes.added.length > 0 ? (
        <section className="snapshot-history__diff-group">
          <h4 className="snapshot-history__diff-title">
            Nodes added since this snapshot ({diff.nodes.added.length})
          </h4>
          <ul className="snapshot-history__diff-list">
            {diff.nodes.added.map((node) => (
              <li key={node.id}>{node.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff.nodes.removed.length > 0 ? (
        <section className="snapshot-history__diff-group">
          <h4 className="snapshot-history__diff-title">
            Nodes removed since this snapshot ({diff.nodes.removed.length})
          </h4>
          <ul className="snapshot-history__diff-list">
            {diff.nodes.removed.map((node) => (
              <li key={node.id}>{node.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff.nodes.changed.length > 0 ? (
        <section className="snapshot-history__diff-group">
          <h4 className="snapshot-history__diff-title">
            Nodes changed ({diff.nodes.changed.length})
          </h4>
          <ul className="snapshot-history__diff-list">
            {diff.nodes.changed.map((change) => (
              <li key={change.id}>
                <strong>{change.after.label}</strong>
                {change.movedOnly ? ' was moved.' : null}
                <ul className="snapshot-history__diff-fields">
                  {change.changes.map((field) => (
                    <li key={field.field}>
                      {field.field}: {field.before} to {field.after}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff.edges.added.length > 0 ? (
        <section className="snapshot-history__diff-group">
          <h4 className="snapshot-history__diff-title">
            Connections added ({diff.edges.added.length})
          </h4>
          <ul className="snapshot-history__diff-list">
            {diff.edges.added.map((edge) => (
              <li key={edge.id}>{edgeName(edge)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff.edges.removed.length > 0 ? (
        <section className="snapshot-history__diff-group">
          <h4 className="snapshot-history__diff-title">
            Connections removed ({diff.edges.removed.length})
          </h4>
          <ul className="snapshot-history__diff-list">
            {diff.edges.removed.map((edge) => (
              <li key={edge.id}>{edgeName(edge)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {diff.edges.changed.length > 0 ? (
        <section className="snapshot-history__diff-group">
          <h4 className="snapshot-history__diff-title">
            Connections changed ({diff.edges.changed.length})
          </h4>
          <ul className="snapshot-history__diff-list">
            {diff.edges.changed.map((change) => (
              <li key={change.id}>
                <strong>{edgeName(change.after)}</strong>
                <ul className="snapshot-history__diff-fields">
                  {change.changes.map((field) => (
                    <li key={field.field}>
                      {field.field}: {field.before} to {field.after}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/**
 * The history of saved workflow snapshots. Each snapshot shows its version, date and
 * note, how it differs from the current workflow, and controls to compare it in
 * detail, restore it or delete it. A new snapshot can be saved from here too.
 */
export function SnapshotHistory() {
  const { status, workflow, snapshots, saveSnapshot, restoreSnapshot, deleteSnapshot } =
    useSnapshots()

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [comparingId, setComparingId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  // One comparison per snapshot against the current workflow: the snapshot is the
  // older version and the current workflow is the newer one.
  const diffs = useMemo(() => {
    const result = new Map<string, WorkflowDiff>()
    if (!workflow) return result
    for (const snapshot of snapshots) {
      result.set(snapshot.id, diffWorkflows(snapshot.workflow, workflow))
    }
    return result
  }, [snapshots, workflow])

  const run = async (action: () => Promise<void>, successText: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      setNotice({ kind: 'success', text: successText })
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workflow || busy) return
    void run(async () => {
      const snapshot = await saveSnapshot(note)
      setNote('')
      setComparingId(null)
      setPending(null)
      return void snapshot
    }, 'Snapshot saved. Further edits now belong to the next version.')
  }

  const handleRestore = (snapshot: WorkflowSnapshot) => {
    setPending(null)
    void run(async () => {
      await restoreSnapshot(snapshot.id)
      setComparingId(null)
    }, `Restored version ${snapshot.version}. The workflow it replaced was saved as a snapshot.`)
  }

  const handleDelete = (snapshot: WorkflowSnapshot) => {
    setPending(null)
    void run(async () => {
      await deleteSnapshot(snapshot.id)
      setComparingId((current) => (current === snapshot.id ? null : current))
    }, `Deleted the snapshot of version ${snapshot.version}.`)
  }

  const toggleCompare = (id: string) => {
    setPending(null)
    setComparingId((current) => (current === id ? null : id))
  }

  return (
    <section className="snapshot-history" aria-labelledby="snapshot-history-heading">
      <h2 id="snapshot-history-heading" className="snapshot-history__title">
        Snapshot history
      </h2>
      <p className="snapshot-history__hint">
        A snapshot keeps the workflow exactly as it is now, so you can compare it with
        later changes or go back to it. Restoring a snapshot never loses the current
        workflow: it is saved as a snapshot first.
      </p>

      <form className="snapshot-history__form" onSubmit={handleSave}>
        <label className="snapshot-history__field" htmlFor="snapshot-note">
          <span className="snapshot-history__label">Note (optional)</span>
          <input
            id="snapshot-note"
            className="snapshot-history__input"
            type="text"
            value={note}
            maxLength={120}
            placeholder="For example: after the team call"
            onChange={(event) => setNote(event.target.value)}
            disabled={busy || !workflow}
          />
        </label>
        <button
          type="submit"
          className="snapshot-history__button snapshot-history__button--primary"
          disabled={busy || !workflow}
        >
          Save snapshot
        </button>
      </form>

      <p
        className={
          notice?.kind === 'error'
            ? 'snapshot-history__notice snapshot-history__notice--error'
            : 'snapshot-history__notice'
        }
        role={notice?.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {notice ? notice.text : ''}
      </p>

      {status === 'loading' ? (
        <p className="snapshot-history__muted" role="status">
          Loading snapshots...
        </p>
      ) : null}

      {status === 'ready' && !workflow ? (
        <p className="snapshot-history__muted">
          There is no workflow stored yet, so there is nothing to take a snapshot of.
        </p>
      ) : null}

      {status === 'ready' && workflow && snapshots.length === 0 ? (
        <p className="snapshot-history__muted">
          No snapshots yet. Save one to start a history of the workflow.
        </p>
      ) : null}

      {snapshots.length > 0 ? (
        <ul className="snapshot-history__list" aria-label="Saved snapshots">
          {snapshots.map((snapshot) => {
            const diff = diffs.get(snapshot.id)
            const isComparing = comparingId === snapshot.id
            const isPending = pending?.id === snapshot.id
            const detailsId = `snapshot-diff-${snapshot.id}`

            return (
              <li key={snapshot.id} className="snapshot-history__item">
                <div className="snapshot-history__item-header">
                  <p className="snapshot-history__version">Version {snapshot.version}</p>
                  <p className="snapshot-history__date">
                    <time dateTime={snapshot.createdAt}>
                      {formatDate(snapshot.createdAt)}
                    </time>
                  </p>
                </div>

                {snapshot.note ? (
                  <p className="snapshot-history__note">{snapshot.note}</p>
                ) : null}

                {diff ? (
                  <p className="snapshot-history__summary">
                    Compared with the current workflow: {summarizeDiff(diff)}
                  </p>
                ) : null}

                <div className="snapshot-history__actions">
                  <button
                    type="button"
                    className="snapshot-history__button"
                    onClick={() => toggleCompare(snapshot.id)}
                    aria-expanded={isComparing}
                    aria-controls={detailsId}
                    disabled={busy || !diff}
                  >
                    {isComparing ? 'Hide comparison' : 'Compare'}
                  </button>

                  {isPending && pending?.kind === 'restore' ? (
                    <span
                      className="snapshot-history__confirm"
                      role="group"
                      aria-label={`Confirm restoring version ${snapshot.version}`}
                    >
                      <span className="snapshot-history__confirm-text">
                        Replace the current workflow with version {snapshot.version}?
                      </span>
                      <button
                        type="button"
                        className="snapshot-history__button snapshot-history__button--primary"
                        onClick={() => handleRestore(snapshot)}
                        disabled={busy}
                      >
                        Confirm restore
                      </button>
                      <button
                        type="button"
                        className="snapshot-history__button"
                        onClick={() => setPending(null)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : isPending && pending?.kind === 'delete' ? (
                    <span
                      className="snapshot-history__confirm"
                      role="group"
                      aria-label={`Confirm deleting the snapshot of version ${snapshot.version}`}
                    >
                      <span className="snapshot-history__confirm-text">
                        Delete this snapshot? This cannot be undone.
                      </span>
                      <button
                        type="button"
                        className="snapshot-history__button snapshot-history__button--danger"
                        onClick={() => handleDelete(snapshot)}
                        disabled={busy}
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        className="snapshot-history__button"
                        onClick={() => setPending(null)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="snapshot-history__button"
                        onClick={() => setPending({ kind: 'restore', id: snapshot.id })}
                        disabled={busy}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="snapshot-history__button snapshot-history__button--danger"
                        onClick={() => setPending({ kind: 'delete', id: snapshot.id })}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {isComparing && diff && workflow ? (
                  <div id={detailsId} className="snapshot-history__diff">
                    <p className="snapshot-history__diff-heading">
                      Version {snapshot.version} compared with the current workflow
                      (version {workflow.version}).
                    </p>
                    <DiffDetails diff={diff} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}