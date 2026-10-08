import { useId, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { Modal } from '../../components/Modal'
import type { AppRecord } from '../../types'

export interface AppFormModalProps {
  /** The app being edited, or null to add a new app. */
  app: AppRecord | null
  /** Called with the complete record when the form is valid. Rejecting keeps the form open and shows the message. */
  onSubmit: (app: AppRecord) => Promise<void> | void
  /** Called when the dialog is closed without saving, and after a successful save. */
  onClose: () => void
}

/** An id that is unique enough for a local, single-user list of apps. */
function createAppId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** A readable message for a failed save. */
function describeSaveError(error: unknown): string {
  const reason = error instanceof Error && error.message ? error.message : 'Unknown error'
  return `The app could not be saved. ${reason}`
}

/**
 * Add/edit form for a tracked app, shown in the shared modal. Input is trimmed and
 * the name is required. On submit it builds a complete AppRecord: a new id and
 * creation time when adding, the existing id and creation time when editing.
 */
export function AppFormModal({ app, onSubmit, onClose }: AppFormModalProps) {
  const isEditing = app !== null
  const idPrefix = useId()
  const nameId = `${idPrefix}-name`
  const nameErrorId = `${idPrefix}-name-error`
  const descriptionId = `${idPrefix}-description`
  const ownerId = `${idPrefix}-owner`
  const notesId = `${idPrefix}-notes`

  const [name, setName] = useState(app?.name ?? '')
  const [description, setDescription] = useState(app?.description ?? '')
  const [owner, setOwner] = useState(app?.owner ?? '')
  const [notes, setNotes] = useState(app?.notes ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    setName(event.target.value)
    if (nameError) setNameError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Name is required.')
      return
    }

    const record: AppRecord = {
      id: app?.id ?? createAppId(),
      name: trimmedName,
      description: description.trim(),
      owner: owner.trim(),
      notes: notes.trim(),
      createdAt: app?.createdAt ?? new Date().toISOString(),
    }

    setSaving(true)
    setSaveError(null)
    try {
      await onSubmit(record)
      onClose()
    } catch (error) {
      setSaveError(describeSaveError(error))
      setSaving(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Edit app' : 'Add app'} onClose={onClose}>
      <form className="apps-form" onSubmit={handleSubmit} noValidate>
        <div className="apps-form__field">
          <label className="apps-form__label" htmlFor={nameId}>
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id={nameId}
            className="apps-form__input"
            type="text"
            value={name}
            onChange={handleNameChange}
            required
            aria-required="true"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
            autoComplete="off"
          />
          {nameError && (
            <p id={nameErrorId} className="apps-form__error" role="alert">
              {nameError}
            </p>
          )}
        </div>

        <div className="apps-form__field">
          <label className="apps-form__label" htmlFor={descriptionId}>
            Description
          </label>
          <textarea
            id={descriptionId}
            className="apps-form__input apps-form__textarea"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="apps-form__field">
          <label className="apps-form__label" htmlFor={ownerId}>
            Owner
          </label>
          <input
            id={ownerId}
            className="apps-form__input"
            type="text"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="apps-form__field">
          <label className="apps-form__label" htmlFor={notesId}>
            Notes
          </label>
          <textarea
            id={notesId}
            className="apps-form__input apps-form__textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {saveError && (
          <p className="apps-form__error" role="alert">
            {saveError}
          </p>
        )}

        <div className="modal__footer">
          <button
            type="button"
            className="modal__button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="modal__button modal__button--primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add app'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default AppFormModal