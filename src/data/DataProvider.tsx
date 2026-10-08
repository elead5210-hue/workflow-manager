import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import * as db from '../db'
import { SEED_WORKFLOW_ID } from '../db/seedWorkflow'
import type { TeamMember, Workflow, WorkflowSnapshot } from '../types'
import { DataContext } from './dataContext'
import type { DataContextValue, DataState, ImportResult } from './dataContext'
import { buildExportBundle, parseExportBundle, serializeExportBundle } from './exportImport'

const INITIAL_STATE: DataState = {
  status: 'loading',
  error: null,
  members: [],
  workflow: null,
  snapshots: [],
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

interface LoadedData {
  members: TeamMember[]
  workflow: Workflow | null
  snapshots: WorkflowSnapshot[]
}

/** Reads members, the main workflow and its snapshots through the single shared DB connection. */
async function readAll(): Promise<LoadedData> {
  const [members, workflow, snapshots] = await Promise.all([
    db.getAllMembers(),
    db.getWorkflow(SEED_WORKFLOW_ID),
    db.listSnapshots(SEED_WORKFLOW_ID),
  ])
  return { members, workflow: workflow ?? null, snapshots }
}

/** A snapshot id that is unique enough for a local, single-user history. */
function createSnapshotId(): string {
  return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Wraps a workflow, as it is right now, in a snapshot record. */
function makeSnapshot(workflow: Workflow, note: string): WorkflowSnapshot {
  return {
    id: createSnapshotId(),
    workflowId: workflow.id,
    version: workflow.version,
    note,
    createdAt: new Date().toISOString(),
    workflow,
  }
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

  // A copy of the latest state for actions that must read the current members or
  // workflow without being recreated every time the state changes.
  const stateRef = useRef<DataState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Updates the state and the copy together, so an action that runs right after
  // another one already sees the new values.
  const applyState = useCallback((update: (prev: DataState) => DataState) => {
    stateRef.current = update(stateRef.current)
    setState(update)
  }, [])

  const load = useCallback(async () => {
    generationRef.current += 1
    const generation = generationRef.current
    try {
      const { members, workflow, snapshots } = await readAll()
      if (generation !== generationRef.current) return
      setState({ status: 'ready', error: null, members, workflow, snapshots })
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
    // Every save moves updatedAt forward. The version number only changes when a
    // snapshot is saved, so autosaving on each edit does not inflate it.
    const stamped: Workflow = { ...workflow, updatedAt: new Date().toISOString() }
    await db.saveWorkflow(stamped)
    generationRef.current += 1
    setState((prev) => ({ ...prev, workflow: stamped }))
  }, [])

  const resetWorkflow = useCallback(async () => {
    const workflow = await db.resetWorkflow()
    generationRef.current += 1
    setState((prev) => ({ ...prev, workflow }))
    return workflow
  }, [])

  const exportData = useCallback(() => {
    const { members, workflow } = stateRef.current
    return serializeExportBundle(buildExportBundle(members, workflow))
  }, [])

  const importData = useCallback(
    async (text: string): Promise<ImportResult> => {
      const parsed = parseExportBundle(text)
      if (!parsed.ok) {
        return { ok: false, errors: parsed.errors }
      }
      const { members, workflow: incoming } = parsed.bundle
      // The app reads one workflow, by the seed id, so the imported one is stored under it.
      const workflow: Workflow | null = incoming
        ? {
            ...incoming,
            id: SEED_WORKFLOW_ID,
            updatedAt: incoming.updatedAt ?? new Date().toISOString(),
          }
        : null

      // Keep the workflow that is about to be replaced, so the import can be undone.
      const current = stateRef.current.workflow
      if (workflow && current) {
        await db.saveSnapshot(makeSnapshot(current, 'Before import'))
      }
      await db.replaceMembersAndWorkflow(members, workflow)

      // Read everything back: without a workflow in the file, the stored workflow is
      // kept but loses owners that are not among the imported members.
      const fresh = await readAll()
      generationRef.current += 1
      applyState((prev) => ({
        ...prev,
        members: fresh.members,
        workflow: fresh.workflow,
        snapshots: fresh.snapshots,
      }))
      return { ok: true, memberCount: members.length, workflowReplaced: workflow !== null }
    },
    [applyState],
  )

  const saveSnapshot = useCallback(
    async (note = '') => {
      const current = stateRef.current.workflow
      if (!current) {
        throw new Error('There is no workflow to take a snapshot of.')
      }
      const snapshot = makeSnapshot(current, note.trim())
      await db.saveSnapshot(snapshot)

      // The snapshot keeps this version number; later edits belong to the next one.
      const next: Workflow = {
        ...current,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      }
      await db.saveWorkflow(next)
      const snapshots = await db.listSnapshots(next.id)
      generationRef.current += 1
      applyState((prev) => ({ ...prev, workflow: next, snapshots }))
      return snapshot
    },
    [applyState],
  )

  const restoreSnapshot = useCallback(
    async (id: string) => {
      const snapshot = await db.getSnapshot(id)
      if (!snapshot) {
        throw new Error('That snapshot no longer exists.')
      }
      // Keep the workflow that is about to be replaced, so the restore can be undone.
      const current = stateRef.current.workflow
      if (current) {
        await db.saveSnapshot(
          makeSnapshot(current, `Before restoring version ${snapshot.version}`),
        )
      }
      const restored: Workflow = {
        ...snapshot.workflow,
        id: SEED_WORKFLOW_ID,
        // Version numbers keep moving forward, so the restored workflow never repeats one.
        version: Math.max(snapshot.workflow.version, current?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      }
      await db.saveWorkflow(restored)
      const snapshots = await db.listSnapshots(restored.id)
      generationRef.current += 1
      applyState((prev) => ({ ...prev, workflow: restored, snapshots }))
      return restored
    },
    [applyState],
  )

  const deleteSnapshot = useCallback(
    async (id: string) => {
      await db.deleteSnapshot(id)
      generationRef.current += 1
      applyState((prev) => ({
        ...prev,
        snapshots: prev.snapshots.filter((snapshot) => snapshot.id !== id),
      }))
    },
    [applyState],
  )

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      reload,
      addMember,
      updateMember,
      deleteMember,
      saveWorkflow,
      resetWorkflow,
      exportData,
      importData,
      saveSnapshot,
      restoreSnapshot,
      deleteSnapshot,
    }),
    [
      state,
      reload,
      addMember,
      updateMember,
      deleteMember,
      saveWorkflow,
      resetWorkflow,
      exportData,
      importData,
      saveSnapshot,
      restoreSnapshot,
      deleteSnapshot,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}