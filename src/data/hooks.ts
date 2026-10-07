import { useContext, useMemo } from 'react'

import { DataContext } from './dataContext'
import type {
  DataContextValue,
  DataState,
  MemberActions,
  ReloadAction,
  WorkflowActions,
} from './dataContext'

/** What useMembers returns: the shared load status, the members and the member write actions. */
export type UseMembersResult = Pick<DataState, 'status' | 'error' | 'members'> &
  MemberActions & { reload: ReloadAction }

/** What useWorkflow returns: the shared load status, the workflow and the workflow write actions. */
export type UseWorkflowResult = Pick<DataState, 'status' | 'error' | 'workflow'> &
  WorkflowActions & { reload: ReloadAction }

/** Reads the shared data context, throwing a clear error when there is no provider above. */
function useDataContext(hookName: string): DataContextValue {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error(`${hookName} must be used inside a <DataProvider>.`)
  }
  return context
}

/** Shared team members, their load status and the actions that change them. */
export function useMembers(): UseMembersResult {
  const {
    status,
    error,
    members,
    addMember,
    updateMember,
    deleteMember,
    reload,
  } = useDataContext('useMembers')

  return useMemo(
    () => ({ status, error, members, addMember, updateMember, deleteMember, reload }),
    [status, error, members, addMember, updateMember, deleteMember, reload],
  )
}

/** The shared workflow, its load status and the actions that change it. */
export function useWorkflow(): UseWorkflowResult {
  const { status, error, workflow, saveWorkflow, resetWorkflow, reload } =
    useDataContext('useWorkflow')

  return useMemo(
    () => ({ status, error, workflow, saveWorkflow, resetWorkflow, reload }),
    [status, error, workflow, saveWorkflow, resetWorkflow, reload],
  )
}