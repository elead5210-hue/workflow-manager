import { createContext } from 'react'

import type { AppRecord, TeamMember, Workflow, WorkflowSnapshot } from '../types'

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
  /** The tracked apps. Empty when none have been saved yet. */
  apps: AppRecord[]
  /** The stored workflow, or null when none is stored yet or it could not be loaded. */
  workflow: Workflow | null
  /** Saved snapshots of the workflow, newest first. Empty when there are none or no workflow. */
  snapshots: WorkflowSnapshot[]
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

/** Write actions for apps. Each writes to IndexedDB first, then updates the shared state. */
export interface AppActions {
  addApp: (app: AppRecord) => Promise<void>
  updateApp: (app: AppRecord) => Promise<void>
  deleteApp: (id: string) => Promise<void>
}

/** What an import did, or why it could not be done. Problems with the file are returned, not thrown. */
export type ImportResult =
  | {
      ok: true
      /** Number of members stored after the import. */
      memberCount: number
      /** True when the file carried a workflow and it replaced the stored one. */
      workflowReplaced: boolean
    }
  | { ok: false; errors: string[] }

/** Write actions for the workflow. Each writes to IndexedDB first, then updates the shared state. */
export interface WorkflowActions {
  /** Saves the workflow with a fresh updatedAt. The version number is left as it is. */
  saveWorkflow: (workflow: Workflow) => Promise<void>
  /** Clears the stored workflow and re-saves the seed workflow. Resolves with the reseeded workflow. */
  resetWorkflow: () => Promise<Workflow>
  /**
   * Writes the members and the workflow as the text of a JSON export file.
   * It works from what is held in state, so it needs no database access.
   */
  exportData: () => string
  /**
   * Reads the text of an export file and, when it is valid, replaces all members and
   * the workflow with its contents. When the file replaces the workflow, the current
   * workflow is saved as a snapshot first, so the import can be undone with
   * `restoreSnapshot`. Problems with the file come back as `errors` and nothing is
   * changed; a database failure rejects, like the other actions.
   */
  importData: (text: string) => Promise<ImportResult>
  /**
   * Saves the current workflow as a snapshot and starts the next version number.
   * `note` is an optional short description of the iteration. Resolves with the
   * snapshot and rejects when there is no workflow.
   */
  saveSnapshot: (note?: string) => Promise<WorkflowSnapshot>
  /**
   * Makes the workflow in a snapshot the current one. The workflow being replaced is
   * saved as a snapshot first, so a restore can be undone. Resolves with the restored
   * workflow and rejects when the snapshot is not found.
   */
  restoreSnapshot: (id: string) => Promise<Workflow>
  /** Deletes a snapshot. */
  deleteSnapshot: (id: string) => Promise<void>
}

/** The complete value held by the data context. */
export interface DataContextValue
  extends DataState,
    MemberActions,
    AppActions,
    WorkflowActions {
  /** Re-reads members and workflow from IndexedDB, for example to retry after an error. */
  reload: ReloadAction
}

/**
 * The shared data context. It has no default value so that the hooks can detect
 * use outside the provider and throw a clear error.
 */
export const DataContext = createContext<DataContextValue | null>(null)
DataContext.displayName = 'DataContext'