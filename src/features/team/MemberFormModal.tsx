import { useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import type { TeamMember } from '../../types'

export interface MemberFormModalProps {
  /** The member to edit, or null to add a new member. */
  member: TeamMember | null
  /** All current members, used for the duplicate-name warning and to keep new ids unique. */
  members: TeamMember[]
  /**
   * Saves the member. The modal shows a saving state until the promise settles
   * and shows the error if it rejects. The parent closes the modal once the
   * promise resolves.
   */
  onSubmit: (member: TeamMember) => Promise<void>
  onClose: () => void
}

type FieldErrors = { name?: string; role?: string }

/** Splits a textarea into trimmed, non-empty lines without repeated entries. */
function splitLines(text: string): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    lines.push(value)
  }
  return lines
}

/** Builds an id such as "member-paul" from the name, adding a number if it is already taken. */
function createMemberId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds)
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'new'
  let candidate = `member-${slug}`
  let counter = 2
  while (taken.has(candidate)) {
    candidate = `member-${slug}-${counter}`
    counter += 1
  }
  return candidate
}

/** Add or edit form for a team member, shown in a modal dialog. */
export function MemberFormModal({
  member,
  members,
  onSubmit,
  onClose,
}: MemberFormModalProps) {
  const baseId = useId()
  const formId = `${baseId}-form`
  const fieldId = (name: string) => `${baseId}-${name}`

  const nameRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState(member?.role ?? '')
  const [responsibilities, setResponsibilities] = useState(
    member ? member.responsibilities.join('\n') : '',
  )
  const [apps, setApps] = useState(member ? member.primaryApps.join('\n') : '')
  const [notes, setNotes] = useState(member?.notes ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const normalizedName = name.trim().toLowerCase()
  const duplicate = useMemo(() => {
    if (!normalizedName) return undefined
    return members.find(
      (other) =>
        other.id !== member?.id &&
        other.name.trim().toLowerCase() === normalizedName,
    )
  }, [members, member, normalizedName])

  const handleClose = () => {
    if (!saving) onClose()
  }

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
    if (errors.name) setErrors((current) => ({ ...current, name: undefined }))
  }

  const handleRoleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRole(event.target.value)
    if (errors.role) setErrors((current) => ({ ...current, role: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return

    const trimmedName = name.trim()
    const trimmedRole = role.trim()
    const nextErrors: FieldErrors = {}
    if (!trimmedName) nextErrors.name = 'Name is required.'
    if (!trimmedRole) nextErrors.role = 'Role is required.'
    setErrors(nextErrors)
    if (nextErrors.name) {
      nameRef.current?.focus()
      return
    }
    if (nextErrors.role) {
      roleRef.current?.focus()
      return
    }

    const details = {
      name: trimmedName,
      role: trimmedRole,
      responsibilities: splitLines(responsibilities),
      primaryApps: splitLines(apps),
      notes: notes.trim(),
    }
    const result: TeamMember = member
      ? { ...member, ...details }
      : {
          id: createMemberId(
            trimmedName,
            members.map((existing) => existing.id),
          ),
          ...details,
          createdAt: new Date().toISOString(),
        }

    setSaving(true)
    setSubmitError(null)
    try {
      await onSubmit(result)
    } catch (error) {
      setSaving(false)
      setSubmitError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return (
    <Modal
      title={member ? `Edit ${member.name}` : 'Add team member'}
      onClose={handleClose}
      closeOnBackdrop={!saving}
      footer={
        <>
          <button
            type="button"
            className="modal__button"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className="modal__button modal__button--primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : member ? 'Save changes' : 'Add member'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="member-form"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <div className="member-form__field">
          <label className="member-form__label" htmlFor={fieldId('name')}>
            Name <span className="member-form__required">(required)</span>
          </label>
          <input
            id={fieldId('name')}
            ref={nameRef}
            className="member-form__input"
            type="text"
            value={name}
            onChange={handleNameChange}
            aria-required="true"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={
              [
                errors.name ? fieldId('name-error') : '',
                duplicate ? fieldId('name-warning') : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            autoComplete="off"
            data-autofocus
          />
          {errors.name ? (
            <p
              id={fieldId('name-error')}
              className="member-form__error"
              role="alert"
            >
              {errors.name}
            </p>
          ) : null}
          {duplicate ? (
            <p
              id={fieldId('name-warning')}
              className="member-form__warning"
              role="status"
            >
              A team member named "{duplicate.name}" already exists. You can
              still save, but check that you are not adding the same person
              twice.
            </p>
          ) : null}
        </div>

        <div className="member-form__field">
          <label className="member-form__label" htmlFor={fieldId('role')}>
            Role <span className="member-form__required">(required)</span>
          </label>
          <input
            id={fieldId('role')}
            ref={roleRef}
            className="member-form__input"
            type="text"
            value={role}
            onChange={handleRoleChange}
            aria-required="true"
            aria-invalid={errors.role ? true : undefined}
            aria-describedby={errors.role ? fieldId('role-error') : undefined}
            autoComplete="off"
          />
          {errors.role ? (
            <p
              id={fieldId('role-error')}
              className="member-form__error"
              role="alert"
            >
              {errors.role}
            </p>
          ) : null}
        </div>

        <div className="member-form__field">
          <label
            className="member-form__label"
            htmlFor={fieldId('responsibilities')}
          >
            Responsibilities
          </label>
          <textarea
            id={fieldId('responsibilities')}
            className="member-form__textarea"
            rows={5}
            value={responsibilities}
            onChange={(event) => setResponsibilities(event.target.value)}
            aria-describedby={fieldId('responsibilities-hint')}
          />
          <p id={fieldId('responsibilities-hint')} className="member-form__hint">
            One responsibility per line.
          </p>
        </div>

        <div className="member-form__field">
          <label className="member-form__label" htmlFor={fieldId('apps')}>
            Apps owned
          </label>
          <textarea
            id={fieldId('apps')}
            className="member-form__textarea"
            rows={3}
            value={apps}
            onChange={(event) => setApps(event.target.value)}
            aria-describedby={fieldId('apps-hint')}
          />
          <p id={fieldId('apps-hint')} className="member-form__hint">
            One app per line.
          </p>
        </div>

        <div className="member-form__field">
          <label className="member-form__label" htmlFor={fieldId('notes')}>
            Notes
          </label>
          <textarea
            id={fieldId('notes')}
            className="member-form__textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {submitError ? (
          <p className="member-form__error" role="alert">
            Could not save the member: {submitError}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}