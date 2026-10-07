import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import * as db from '../db'
import { SEED_WORKFLOW_ID } from '../db/seedWorkflow'
import type { TeamMember, Workflow } from '../types'
import { DataContext } from './dataContext'
import type { DataContextValue, DataState } from './dataContext'

const INITIAL_STATE: DataState = {
  status: 'loading',
  error: null,
  members: [],
  workflow: null,
}

/** Turns a database failure into a clear, user-facing message. */
function describeLoadError(error: unknown): string {
  const reason =
    error instanceof Error && error.message ? error.message : 'Unknown database error'
  return (
    'The app could not read its local data. Private browsing or blocked site ' +
    'storage can stop the browser database from opening. Check your browser ' +
    `settings and reload the page. (${reason})`
  )
}

/** Reads members and the main workflow through the single shared DB connection. */
async function readAll(): Promise<{ members: TeamMember[]; workflow: Workflow | null }> {
  const [members, workflow] = await Promise.all([
    db.getAllMembers(),
    db.getWorkflow(SEED_WORKFLOW_ID),
  ])
  return { members, workflow: workflow ?? null }
}

interface DataProviderProps {
  children: ReactNode
}

/**
 * Holds the members and the workflow as the one source of truth for every page.
 * All reads and writes go through the shared database module, and every write
 * updates this state after it has been stored, so pages stay in sync.
 */
export function DataProvider({ children }: DataProviderProps) {
  const [state, setState] = useState<DataState>(INITIAL_STATE)

  // Incremented whenever a load starts, a write completes or the provider unmounts.
  // A load only applies its result if no newer event happened while it was running,
  // so stale reads (including the first one under StrictMode) are ignored.
  const generationRef = useRef(0)

  const load = useCallback(async () => {
    generationRef.current += 1
    const generation = generationRef.current
    try {
      const { members, workflow } = await readAll()
      if (generation !== generationRef.current) return
      setState({ status: 'ready', error: null, members, workflow })
    } catch (error) {
      if (generation !== generationRef.current) return
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: describeLoadError(error),
      }))
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      // Invalidate any load still in flight when the provider unmounts or
      // StrictMode re-runs this effect.
      generationRef.current += 1
    }
  }, [load])

  const reload = useCallback(async () => {
    setState((prev) =>
      prev.status === 'error' ? { ...prev, status: 'loading', error: null } : prev,
    )
    await load()
  }, [load])

  const addMember = useCallback(async (member: TeamMember) => {
    await db.addMember(member)
    generationRef.current += 1
    setState((prev) => ({ ...prev, members: [...prev.members, member] }))
  }, [])

  const updateMember = useCallback(async (member: TeamMember) => {
    await db.updateMember(member)
    generationRef.current += 1
    setState((prev) => ({
      ...prev,
      members: prev.members.map((existing) =>
        existing.id === member.id ? member : existing,
      ),
    }))
  }, [])

  const deleteMember = useCallback(async (id: string) => {
    const unassigned = await db.deleteMemberAndUnassign(id)
    generationRef.current += 1
    setState((prev) => ({
      ...prev,
      members: prev.members.filter((member) => member.id !== id),
      workflow: prev.workflow
        ? {
            ...prev.workflow,
            nodes: prev.workflow.nodes.map((node) => {
              if (node.ownerId !== id) return node
              const updated = { ...node }
              delete updated.ownerId
              return updated
            }),
          }
        : prev.workflow,
    }))
    return unassigned
  }, [])

  const saveWorkflow = useCallback(async (workflow: Workflow) => {
    await db.saveWorkflow(workflow)
    generationRef.current += 1
    setState((prev) => ({ ...prev, workflow }))
  }, [])

  const resetWorkflow = useCallback(async () => {
    const workflow = await db.resetWorkflow()
    generationRef.current += 1
    setState((prev) => ({ ...prev, workflow }))
    return workflow
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      reload,
      addMember,
      updateMember,
      deleteMember,
      saveWorkflow,
      resetWorkflow,
    }),
    [state, reload, addMember, updateMember, deleteMember, saveWorkflow, resetWorkflow],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}