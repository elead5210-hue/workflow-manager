import { createContext } from 'react'

import type { TeamMember, Workflow } from '../types'

/**
 * Where the shared data is in its life cycle.
 * - loading: the first read from IndexedDB has not finished yet.
 * - ready: members and workflow have been read (the workflow may still be null if none is stored).
 * - error: the database could not be opened or read; see `error` for the message.
 */
export type DataStatus = 'loading' | 'ready' | 'error'

/** A reload of members and workflow from IndexedDB. */
export type ReloadAction = () => Promise<void>

/** Read-only view of the shared state. */
export interface DataState {
  status: DataStatus
  /** A clear, user-facing message when status is 'error', otherwise null. */
  error: string | null
  members: TeamMember[]
  /** The stored workflow, or null when none is stored yet or it could not be loaded. */
  workflow: Workflow | null
}

/** Write actions for members. Each writes to IndexedDB first, then updates the shared state. */
export interface MemberActions {
  addMember: (member: TeamMember) => Promise<void>
  updateMember: (member: TeamMember) => Promise<void>
  /**
   * Removes the member and clears the owner on every workflow node that
   * referenced it. Resolves with the number of workflow nodes that lost their owner.
   */
  deleteMember: (id: string) => Promise<number>
}

/** Write actions for the workflow. Each writes to IndexedDB first, then updates the shared state. */
export interface WorkflowActions {
  saveWorkflow: (workflow: Workflow) => Promise<void>
  /** Clears the stored workflow and re-saves the seed workflow. Resolves with the reseeded workflow. */
  resetWorkflow: () => Promise<Workflow>
}

/** The complete value held by the data context. */
export interface DataContextValue extends DataState, MemberActions, WorkflowActions {
  /** Re-reads members and workflow from IndexedDB, for example to retry after an error. */
  reload: ReloadAction
}

/**
 * The shared data context. It has no default value so that the hooks can detect
 * use outside the provider and throw a clear error.
 */
export const DataContext = createContext<DataContextValue | null>(null)
DataContext.displayName = 'DataContext'