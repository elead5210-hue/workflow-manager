// IndexedDB data layer for the workflow manager.
import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { AppRecord, TeamMember, Workflow, WorkflowSnapshot } from '../types'
import { seedMembers } from './seedMembers'
import { seedWorkflow } from './seedWorkflow'

export const DB_NAME = 'workflow-manager'
/** Bump this and add an `oldVersion < N` block in `upgrade` for every schema change. */
export const DB_VERSION = 4

const MEMBERS_STORE = 'members'
const WORKFLOWS_STORE = 'workflows'
const META_STORE = 'meta'
const SNAPSHOTS_STORE = 'snapshots'
const APPS_STORE = 'apps'
const SEEDED_KEY = 'seeded'

/** Most snapshots kept per workflow. Saving a new one removes the oldest beyond this. */
export const MAX_SNAPSHOTS = 20

interface WorkflowManagerDB extends DBSchema {
  members: {
    key: string
    value: TeamMember
  }
  workflows: {
    key: string
    value: Workflow
  }
  meta: {
    key: string
    value: unknown
  }
  snapshots: {
    key: string
    value: WorkflowSnapshot
    indexes: { 'by-workflow': string }
  }
  apps: {
    key: string
    value: AppRecord
  }
}

type Db = IDBPDatabase<WorkflowManagerDB>

/** Error thrown by every data layer function when an IndexedDB operation fails. */
export class DbError extends Error {
  readonly originalError: unknown

  constructor(message: string, originalError?: unknown) {
    super(message)
    this.name = 'DbError'
    this.originalError = originalError
  }
}

let dbPromise: Promise<Db> | null = null

/** Opens the database once and shares the connection between all callers. */
function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = openDB<WorkflowManagerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Migration path: each block upgrades the schema from the previous version.
        if (oldVersion < 1) {
          db.createObjectStore(MEMBERS_STORE, { keyPath: 'id' })
          db.createObjectStore(WORKFLOWS_STORE, { keyPath: 'id' })
          db.createObjectStore(META_STORE)
        }
        if (oldVersion < 2) {
          // Snapshot history of the workflow, looked up by the workflow it belongs to.
          const snapshots = db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' })
          snapshots.createIndex('by-workflow', 'workflowId')
        }
        if (oldVersion >= 1 && oldVersion < 3) {
          // The workflow now follows the example workflow (lanes, columns and edge styles).
          // Existing databases still hold the old workflow, so replace it with the new seed.
          // A brand new database is seeded on first load instead.
          const workflows = transaction.objectStore(WORKFLOWS_STORE)
          void workflows.clear()
          void workflows.put(seedWorkflow)
        }
        if (oldVersion < 4) {
          // Records of the apps tracked in the workflow.
          db.createObjectStore(APPS_STORE, { keyPath: 'id' })
        }
        // if (oldVersion < 5) { ...future migration... }
      },
      blocking() {
        // Another tab wants to upgrade the schema: release our connection.
        const current = dbPromise
        dbPromise = null
        void current?.then((db) => db.close())
      },
      terminated() {
        dbPromise = null
      },
    }).catch((error: unknown) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

async function run<T>(action: string, fn: (db: Db) => Promise<T>): Promise<T> {
  try {
    const db = await getDb()
    return await fn(db)
  } catch (error) {
    if (error instanceof DbError) throw error
    const reason = error instanceof Error ? error.message : String(error)
    throw new DbError(`Failed to ${action}: ${reason}`, error)
  }
}

/** Returns all team members. */
export function getAllMembers(): Promise<TeamMember[]> {
  return run('load team members', (db) => db.getAll(MEMBERS_STORE))
}

/** Adds a new team member. Fails if a member with the same id already exists. */
export function addMember(member: TeamMember): Promise<void> {
  return run('add team member', async (db) => {
    await db.add(MEMBERS_STORE, member)
  })
}

/** Updates an existing team member. Fails if the member does not exist. */
export function updateMember(member: TeamMember): Promise<void> {
  return run('update team member', async (db) => {
    const tx = db.transaction(MEMBERS_STORE, 'readwrite')
    const existing = await tx.store.get(member.id)
    if (!existing) {
      throw new DbError(`Team member "${member.id}" does not exist`)
    }
    await Promise.all([tx.store.put(member), tx.done])
  })
}

/** Deletes a team member by id. */
export function deleteMember(id: string): Promise<void> {
  return run('delete team member', (db) => db.delete(MEMBERS_STORE, id))
}

/**
 * Deletes a team member and clears `ownerId` on every workflow node that
 * referenced them, in a single transaction over the members and workflows
 * stores. Either both changes apply or neither does, so no stored node is left
 * pointing at a removed member.
 * Resolves to the number of workflow nodes that lost their owner.
 */
export function deleteMemberAndUnassign(id: string): Promise<number> {
  return run('delete team member and unassign workflow nodes', async (db) => {
    const tx = db.transaction([MEMBERS_STORE, WORKFLOWS_STORE], 'readwrite')
    const workflowsStore = tx.objectStore(WORKFLOWS_STORE)
    const workflows = await workflowsStore.getAll()
    let unassigned = 0
    for (const workflow of workflows) {
      let changed = false
      const nodes = workflow.nodes.map((node) => {
        if (node.ownerId !== id) return node
        const updated = { ...node }
        delete updated.ownerId
        unassigned += 1
        changed = true
        return updated
      })
      if (changed) await workflowsStore.put({ ...workflow, nodes })
    }
    await tx.objectStore(MEMBERS_STORE).delete(id)
    await tx.done
    return unassigned
  })
}

/** Returns all tracked apps. */
export function getAllApps(): Promise<AppRecord[]> {
  return run('load apps', (db) => db.getAll(APPS_STORE))
}

/** Adds a new app record. Fails if an app with the same id already exists. */
export function addApp(app: AppRecord): Promise<void> {
  return run('add app', async (db) => {
    await db.add(APPS_STORE, app)
  })
}

/** Updates an existing app record. Fails if the app does not exist. */
export function updateApp(app: AppRecord): Promise<void> {
  return run('update app', async (db) => {
    const tx = db.transaction(APPS_STORE, 'readwrite')
    const existing = await tx.store.get(app.id)
    if (!existing) {
      throw new DbError(`App "${app.id}" does not exist`)
    }
    await Promise.all([tx.store.put(app), tx.done])
  })
}

/** Deletes an app record by id. */
export function deleteApp(id: string): Promise<void> {
  return run('delete app', (db) => db.delete(APPS_STORE, id))
}

/** Returns the workflow with the given id, or undefined if it is not stored. */
export function getWorkflow(id: string): Promise<Workflow | undefined> {
  return run('load workflow', (db) => db.get(WORKFLOWS_STORE, id))
}

/** Creates or replaces a workflow. */
export function saveWorkflow(workflow: Workflow): Promise<void> {
  return run('save workflow', async (db) => {
    await db.put(WORKFLOWS_STORE, workflow)
  })
}

/**
 * Clears the workflows store and re-saves the seed workflow in a single
 * transaction, so the reset either fully applies or leaves the stored
 * workflow untouched. Team members and the 'seeded' flag are not changed.
 */
export function resetWorkflow(): Promise<Workflow> {
  return run('reset workflow to seed data', async (db) => {
    const tx = db.transaction(WORKFLOWS_STORE, 'readwrite')
    await tx.store.clear()
    await tx.store.put(seedWorkflow)
    await tx.done
    return seedWorkflow
  })
}

/** Orders snapshots from newest to oldest. */
function newestFirst(a: WorkflowSnapshot, b: WorkflowSnapshot): number {
  return (
    b.createdAt.localeCompare(a.createdAt) ||
    b.version - a.version ||
    b.id.localeCompare(a.id)
  )
}

/**
 * Saves a snapshot, then removes the oldest snapshots of the same workflow
 * beyond MAX_SNAPSHOTS. The save and the trimming share one transaction, so the
 * history is never left over its cap.
 */
export function saveSnapshot(snapshot: WorkflowSnapshot): Promise<void> {
  return run('save workflow snapshot', async (db) => {
    const tx = db.transaction(SNAPSHOTS_STORE, 'readwrite')
    await tx.store.put(snapshot)
    const sameWorkflow = await tx.store.index('by-workflow').getAll(snapshot.workflowId)
    sameWorkflow.sort(newestFirst)
    for (const stale of sameWorkflow.slice(MAX_SNAPSHOTS)) {
      await tx.store.delete(stale.id)
    }
    await tx.done
  })
}

/** Returns the snapshots of a workflow, newest first. */
export function listSnapshots(workflowId: string): Promise<WorkflowSnapshot[]> {
  return run('load workflow snapshots', async (db) => {
    const snapshots = await db.getAllFromIndex(SNAPSHOTS_STORE, 'by-workflow', workflowId)
    return snapshots.sort(newestFirst)
  })
}

/** Returns the snapshot with the given id, or undefined if it is not stored. */
export function getSnapshot(id: string): Promise<WorkflowSnapshot | undefined> {
  return run('load workflow snapshot', (db) => db.get(SNAPSHOTS_STORE, id))
}

/** Deletes a snapshot by id. */
export function deleteSnapshot(id: string): Promise<void> {
  return run('delete workflow snapshot', (db) => db.delete(SNAPSHOTS_STORE, id))
}

/**
 * Replaces all team members and the stored workflow with imported ones in a
 * single transaction, so an import either fully applies or changes nothing.
 * When `workflow` is null the stored workflows are kept, but any node owned by a
 * member that is not in the imported list loses its owner, so no node points at a
 * missing member. Snapshots are not touched. The caller decides which workflow id
 * is stored; the app reads the workflow by the seed workflow id.
 */
export function replaceMembersAndWorkflow(
  members: TeamMember[],
  workflow: Workflow | null,
): Promise<void> {
  return run('import members and workflow', async (db) => {
    const tx = db.transaction([MEMBERS_STORE, WORKFLOWS_STORE, META_STORE], 'readwrite')
    const membersStore = tx.objectStore(MEMBERS_STORE)
    const workflowsStore = tx.objectStore(WORKFLOWS_STORE)

    await membersStore.clear()
    await Promise.all(members.map((member) => membersStore.put(member)))

    if (workflow) {
      await workflowsStore.clear()
      await workflowsStore.put(workflow)
    } else {
      const memberIds = new Set(members.map((member) => member.id))
      const stored = await workflowsStore.getAll()
      for (const existing of stored) {
        const orphaned = existing.nodes.some(
          (node) => node.ownerId !== undefined && !memberIds.has(node.ownerId),
        )
        if (!orphaned) continue
        const nodes = existing.nodes.map((node) => {
          if (node.ownerId === undefined || memberIds.has(node.ownerId)) return node
          const updated = { ...node }
          delete updated.ownerId
          return updated
        })
        await workflowsStore.put({ ...existing, nodes })
      }
    }

    // The imported data counts as the initial data, so the seed never overwrites it.
    await tx.objectStore(META_STORE).put(true, SEEDED_KEY)
    await tx.done
  })
}

/** Returns true once the initial seed data has been written. */
export function isSeeded(): Promise<boolean> {
  return run('read seeded flag', async (db) => {
    const value = await db.get(META_STORE, SEEDED_KEY)
    return value === true
  })
}

/** Records that the initial seed data has been written. */
export function markSeeded(): Promise<void> {
  return run('set seeded flag', async (db) => {
    await db.put(META_STORE, true, SEEDED_KEY)
  })
}

let seedPromise: Promise<boolean> | null = null

/**
 * Writes the seed members and the seed workflow and sets the 'seeded' flag in a
 * single transaction, only when the flag is absent. Safe to call repeatedly: the flag check and the
 * writes share one readwrite transaction, so a refresh, a second tab or a
 * StrictMode double-mount never duplicates records.
 * Resolves to true if seed data was written by this call, false otherwise.
 */
export function seedIfNeeded(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = run('seed initial data', async (db) => {
      const tx = db.transaction(
        [MEMBERS_STORE, WORKFLOWS_STORE, META_STORE],
        'readwrite',
      )
      const flag = await tx.objectStore(META_STORE).get(SEEDED_KEY)
      if (flag === true) {
        await tx.done
        return false
      }
      const membersStore = tx.objectStore(MEMBERS_STORE)
      await Promise.all(seedMembers.map((member) => membersStore.put(member)))
      await tx.objectStore(WORKFLOWS_STORE).put(seedWorkflow)
      await tx.objectStore(META_STORE).put(true, SEEDED_KEY)
      await tx.done
      return true
    }).catch((error: unknown) => {
      seedPromise = null
      throw error
    })
  }
  return seedPromise
}