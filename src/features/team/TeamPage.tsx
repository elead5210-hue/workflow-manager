import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMembers, useWorkflow } from '../../data/hooks'
import type { TeamMember, WorkflowNode } from '../../types'
import { Modal } from '../../components/Modal'
import { MemberFormModal } from './MemberFormModal'
import './TeamPage.css'

/** Which member form is open: adding a new member or editing an existing one. */
type FormTarget = { mode: 'add' } | { mode: 'edit'; member: TeamMember }

type SortKey = 'name-asc' | 'name-desc' | 'role' | 'nodes'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name-asc', label: 'Name (A to Z)' },
  { value: 'name-desc', label: 'Name (Z to A)' },
  { value: 'role', label: 'Role' },
  { value: 'nodes', label: 'Most workflow nodes owned' },
]

/** True when every word of the query appears somewhere in the member's details. */
function matchesQuery(member: TeamMember, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = [
    member.name,
    member.role,
    member.notes,
    ...member.responsibilities,
    ...member.primaryApps,
  ]
    .join('\n')
    .toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/** Reads the member id from a URL hash such as "#member-paul". */
function memberIdFromHash(hash: string): string {
  if (!hash) return ''
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return hash.slice(1)
  }
}

/** Number of member accent colours defined in the shared design tokens (--color-member-1 to 6). */
const MEMBER_COLOR_COUNT = 6

/** Picks a stable accent colour number (1 to 6) from the member id, so a member keeps the same colour. */
function memberColorNumber(id: string): number {
  let sum = 0
  for (let index = 0; index < id.length; index += 1) {
    sum = (sum * 31 + id.charCodeAt(index)) % 9973
  }
  return (sum % MEMBER_COLOR_COUNT) + 1
}

export default function TeamPage() {
  const { status, error, members, addMember, updateMember, deleteMember, reload } =
    useMembers()
  const { workflow } = useWorkflow()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const { hash } = useLocation()
  const highlightedId = memberIdFromHash(hash)
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const retry = useCallback(() => {
    void reload()
  }, [reload])

  /** Adds a new member or saves changes to an existing one, then updates the list in place. */
  const handleSaveMember = useCallback(
    async (member: TeamMember) => {
      const isEdit = formTarget?.mode === 'edit'
      if (isEdit) await updateMember(member)
      else await addMember(member)
      setFormTarget(null)
      setNotice(
        isEdit
          ? `Saved changes to ${member.name}.`
          : `Added ${member.name} to the team.`,
      )
    },
    [formTarget, addMember, updateMember],
  )

  const closeDelete = useCallback(() => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }, [deleting])

  /** Deletes the member and clears them as owner of their workflow nodes, then updates the page in place. */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleting(true)
    setDeleteError(null)
    try {
      const unassigned = await deleteMember(target.id)
      setDeleteTarget(null)
      setDeleting(false)
      setNotice(
        unassigned > 0
          ? `Deleted ${target.name}. ${unassigned} workflow ${
              unassigned === 1 ? 'node now has' : 'nodes now have'
            } no owner.`
          : `Deleted ${target.name}.`,
      )
    } catch (error) {
      setDeleting(false)
      setDeleteError(error instanceof Error ? error.message : 'Unknown error')
    }
  }, [deleteTarget, deleteMember])

  const nodes = workflow ? workflow.nodes : null

  /** Workflow nodes grouped by the id of the member who owns them. */
  const nodesByOwner = useMemo(() => {
    const grouped = new Map<string, WorkflowNode[]>()
    for (const node of nodes ?? []) {
      if (!node.ownerId) continue
      const owned = grouped.get(node.ownerId)
      if (owned) owned.push(node)
      else grouped.set(node.ownerId, [node])
    }
    return grouped
  }, [nodes])

  const visibleMembers = useMemo(() => {
    const ownedCount = (member: TeamMember) => nodesByOwner.get(member.id)?.length ?? 0
    const filtered = members.filter((member) => matchesQuery(member, query))
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'role':
          return a.role.localeCompare(b.role) || a.name.localeCompare(b.name)
        case 'nodes':
          return ownedCount(b) - ownedCount(a) || a.name.localeCompare(b.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [members, nodesByOwner, query, sortKey])

  const deleteOwnedCount = deleteTarget
    ? (nodesByOwner.get(deleteTarget.id)?.length ?? 0)
    : 0

  // Bring the member named in the URL hash into view once the cards are on the page.
  useEffect(() => {
    if (status !== 'ready' || !highlightedId) return
    document.getElementById(highlightedId)?.scrollIntoView({ block: 'center' })
  }, [status, highlightedId])

  return (
    <section className="team-page" aria-labelledby="team-heading">
      <div className="team-page__header">
        <h1 id="team-heading">Team</h1>
        <p className="team-page__hint">
          Who does what, which apps they own and which workflow nodes they are
          responsible for.
        </p>
        <button
          type="button"
          className="team-button team-button--primary"
          onClick={() => {
            setNotice(null)
            setFormTarget({ mode: 'add' })
          }}
        >
          Add member
        </button>
      </div>

      {notice ? (
        <p className="team-page__notice" role="status">
          {notice}
        </p>
      ) : null}

      {status === 'loading' ? (
        <div className="team-empty" role="status" aria-live="polite">
          <p className="team-empty__title">Loading team</p>
          <p className="team-empty__text">
            Reading the team members from local storage.
          </p>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="team-empty team-empty--error" role="alert">
          <p className="team-empty__title">The team could not be loaded</p>
          <p className="team-empty__text">{error}</p>
          <button type="button" className="team-empty__action" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}

      {status === 'ready' && members.length === 0 ? (
        <div className="team-empty" role="status">
          <p className="team-empty__title">No team members yet</p>
          <p className="team-empty__text">
            There are no team members stored in this browser. Members will
            appear here as soon as they exist.
          </p>
          <button
            type="button"
            className="team-empty__action"
            onClick={() => {
              setNotice(null)
              setFormTarget({ mode: 'add' })
            }}
          >
            Add member
          </button>
          <button type="button" className="team-empty__action" onClick={retry}>
            Reload
          </button>
        </div>
      ) : null}

      {status === 'ready' && members.length > 0 ? (
        <>
          <div className="team-toolbar" role="search" aria-label="Filter and sort team members">
            <label className="team-toolbar__field team-toolbar__field--search" htmlFor="team-search">
              <span className="team-toolbar__label">Filter members</span>
              <input
                id="team-search"
                aria-controls="team-member-list"
                className="team-toolbar__input"
                type="search"
                value={query}
                placeholder="Name, role, responsibility or app"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="team-toolbar__field" htmlFor="team-sort">
              <span className="team-toolbar__label">Sort by</span>
              <select
                id="team-sort"
                aria-controls="team-member-list"
                className="team-toolbar__select"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="team-toolbar__count" role="status" aria-live="polite">
              Showing {visibleMembers.length} of {members.length}{' '}
              {members.length === 1 ? 'member' : 'members'}
            </p>
          </div>

          {visibleMembers.length === 0 ? (
            <div className="team-empty" role="status">
              <p className="team-empty__title">No members match your filter</p>
              <p className="team-empty__text">
                Nobody matches "{query.trim()}". Try a different word or clear the
                filter.
              </p>
              <button
                type="button"
                className="team-empty__action"
                onClick={() => setQuery('')}
              >
                Clear filter
              </button>
            </div>
          ) : (
            <ul
              className="team-grid"
              id="team-member-list"
              aria-label={`Team members, ${visibleMembers.length} shown`}
            >
              {visibleMembers.map((member) => {
                const owned = nodesByOwner.get(member.id) ?? []
                const headingId = `${member.id}-name`
                const highlighted = member.id === highlightedId
                const cardClass = [
                  'team-card',
                  `team-card--member-${memberColorNumber(member.id)}`,
                  highlighted ? 'team-card--highlighted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li key={member.id}>
                    <article
                      id={member.id}
                      className={cardClass}
                      aria-labelledby={headingId}
                    >
                      <header className="team-card__header">
                        <h2 id={headingId} className="team-card__name">
                          {member.name}
                        </h2>
                        <p className="team-card__role">{member.role}</p>
                      </header>

                      <section className="team-card__section">
                        <h3 className="team-card__section-title">Responsibilities</h3>
                        {member.responsibilities.length > 0 ? (
                          <ul
                            className="team-card__list"
                            aria-label={`Responsibilities of ${member.name}`}
                          >
                            {member.responsibilities.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="team-card__muted">No responsibilities listed.</p>
                        )}
                      </section>

                      <section className="team-card__section">
                        <h3 className="team-card__section-title">Apps owned</h3>
                        {member.primaryApps.length > 0 ? (
                          <ul
                            className="team-card__apps"
                            aria-label={`Apps owned by ${member.name}`}
                          >
                            {member.primaryApps.map((app) => (
                              <li key={app} className="team-card__app">
                                {app}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="team-card__muted">No apps listed.</p>
                        )}
                      </section>

                      <section className="team-card__section">
                        <h3 className="team-card__section-title">
                          Workflow nodes ({owned.length})
                        </h3>
                        {owned.length > 0 ? (
                          <ul
                            className="team-card__nodes"
                            aria-label={`Workflow nodes owned by ${member.name}`}
                          >
                            {owned.map((node) => (
                              <li key={node.id}>
                                <Link
                                  className="team-card__node-link"
                                  to={{
                                    pathname: '/workflow',
                                    search: `?node=${encodeURIComponent(node.id)}`,
                                  }}
                                >
                                  {node.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="team-card__muted">
                            No workflow nodes assigned yet.
                          </p>
                        )}
                      </section>

                      {member.notes ? (
                        <section className="team-card__section">
                          <h3 className="team-card__section-title">Notes</h3>
                          <p className="team-card__muted">{member.notes}</p>
                        </section>
                      ) : null}

                      <div className="team-card__actions">
                        <button
                          type="button"
                          className="team-button"
                          aria-label={`Edit ${member.name}`}
                          onClick={() => {
                            setNotice(null)
                            setFormTarget({ mode: 'edit', member })
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="team-button team-button--danger"
                          aria-label={`Delete ${member.name}`}
                          onClick={() => {
                            setNotice(null)
                            setDeleteError(null)
                            setDeleteTarget(member)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : null}

      {formTarget && status === 'ready' ? (
        <MemberFormModal
          member={formTarget.mode === 'edit' ? formTarget.member : null}
          members={members}
          onSubmit={handleSaveMember}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      {deleteTarget ? (
        <Modal
          title={`Delete ${deleteTarget.name}?`}
          onClose={closeDelete}
          closeOnBackdrop={!deleting}
          footer={
            <>
              <button
                type="button"
                className="modal__button"
                onClick={closeDelete}
                disabled={deleting}
                data-autofocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal__button modal__button--danger"
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete member'}
              </button>
            </>
          }
        >
          <p className="team-delete__text">
            Delete <strong>{deleteTarget.name}</strong> from the team? This cannot
            be undone.
          </p>
          <p className="team-delete__warning" role="status">
            {deleteOwnedCount > 0
              ? `${deleteOwnedCount} workflow ${
                  deleteOwnedCount === 1 ? 'node' : 'nodes'
                } owned by ${deleteTarget.name} will be left without an owner. The ${
                  deleteOwnedCount === 1 ? 'node itself is' : 'nodes themselves are'
                } kept.`
              : `No workflow nodes are owned by ${deleteTarget.name}.`}
          </p>
          {deleteError ? (
            <p className="team-delete__error" role="alert">
              Could not delete the member: {deleteError}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </section>
  )
}