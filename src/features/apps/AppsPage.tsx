import { useMemo, useState } from 'react'

import Modal from '../../components/Modal'
import { useApps } from '../../data/hooks'
import type { AppRecord } from '../../types'
import { AppFormModal } from './AppFormModal'
import './AppsPage.css'

/** Which form dialog is open: adding a new app, editing one, or none. */
type FormState = { mode: 'add' } | { mode: 'edit'; app: AppRecord } | null

/** A readable message for a failed delete. */
function describeDeleteError(error: unknown): string {
  const reason = error instanceof Error && error.message ? error.message : 'Unknown error'
  return `The app could not be deleted. ${reason}`
}

/**
 * The Apps page: a list of the apps tracked in the workflow, shown as cards, with
 * add, edit and delete (after confirmation). Everything is read from and written
 * to the shared data through useApps, so other pages stay in sync.
 */
export function AppsPage() {
  const { status, error, apps, addApp, updateApp, deleteApp, reload } = useApps()

  const [form, setForm] = useState<FormState>(null)
  const [appToDelete, setAppToDelete] = useState<AppRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const sortedApps = useMemo(
    () => [...apps].sort((a, b) => a.name.localeCompare(b.name)),
    [apps],
  )

  function openAddForm() {
    setForm({ mode: 'add' })
  }

  function openEditForm(app: AppRecord) {
    setForm({ mode: 'edit', app })
  }

  function closeForm() {
    setForm(null)
  }

  function openDeleteConfirmation(app: AppRecord) {
    setDeleteError(null)
    setAppToDelete(app)
  }

  function closeDeleteConfirmation() {
    if (deleting) return
    setAppToDelete(null)
    setDeleteError(null)
  }

  async function handleSubmit(record: AppRecord) {
    if (form?.mode === 'edit') {
      await updateApp(record)
    } else {
      await addApp(record)
    }
  }

  async function handleConfirmDelete() {
    if (!appToDelete || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteApp(appToDelete.id)
      setAppToDelete(null)
    } catch (caught) {
      setDeleteError(describeDeleteError(caught))
    } finally {
      setDeleting(false)
    }
  }

  function renderContent() {
    if (status === 'loading') {
      return (
        <p className="apps-page__status" role="status">
          Loading apps…
        </p>
      )
    }

    if (status === 'error') {
      return (
        <div className="apps-page__status apps-page__status--error" role="alert">
          <p>{error ?? 'The apps could not be loaded.'}</p>
          <button type="button" className="app-card__button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )
    }

    if (sortedApps.length === 0) {
      return (
        <div className="apps-page__empty">
          <h2 className="apps-page__empty-title">No apps yet</h2>
          <p className="apps-page__empty-text">
            Save a record of each app that is part of the workflow, and it will show up here.
          </p>
          <button type="button" className="apps-page__add" onClick={openAddForm}>
            Add app
          </button>
        </div>
      )
    }

    return (
      <ul className="apps-page__grid" aria-label="Tracked apps">
        {sortedApps.map((app) => (
          <li key={app.id} className="app-card">
            <h2 className="app-card__name">{app.name}</h2>
            {app.description && <p className="app-card__description">{app.description}</p>}
            {app.owner && (
              <dl className="app-card__meta">
                <div className="app-card__meta-row">
                  <dt>Owner</dt>
                  <dd>{app.owner}</dd>
                </div>
              </dl>
            )}
            {app.notes && <p className="app-card__notes">{app.notes}</p>}
            <div className="app-card__actions">
              <button
                type="button"
                className="app-card__button"
                onClick={() => openEditForm(app)}
                aria-label={`Edit ${app.name}`}
              >
                Edit
              </button>
              <button
                type="button"
                className="app-card__button app-card__button--danger"
                onClick={() => openDeleteConfirmation(app)}
                aria-label={`Delete ${app.name}`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="apps-page" aria-labelledby="apps-page-title">
      <header className="apps-page__header">
        <div className="apps-page__heading">
          <h1 id="apps-page-title" className="apps-page__title">
            Apps
          </h1>
          <p className="apps-page__intro">The apps that are tracked in the workflow.</p>
        </div>
        {status === 'ready' && sortedApps.length > 0 && (
          <button type="button" className="apps-page__add" onClick={openAddForm}>
            Add app
          </button>
        )}
      </header>

      {renderContent()}

      {form && (
        <AppFormModal
          key={form.mode === 'edit' ? form.app.id : 'new'}
          app={form.mode === 'edit' ? form.app : null}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {appToDelete && (
        <Modal title="Delete app" onClose={closeDeleteConfirmation}>
          <p className="apps-delete__text">
            Delete <strong>{appToDelete.name}</strong>?
          </p>
          <p className="apps-delete__hint">This removes the record and cannot be undone.</p>
          {deleteError && (
            <p className="apps-form__error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal__footer">
            <button
              type="button"
              className="modal__button"
              onClick={closeDeleteConfirmation}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal__button modal__button--danger"
              onClick={() => void handleConfirmDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete app'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default AppsPage