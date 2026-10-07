// IndexedDB data layer for the workflow manager.
import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { TeamMember, Workflow } from '../types'
import { seedMembers } from './seedMembers'

export const DB_NAME = 'workflow-manager'
/** Bump this and add an `oldVersion < N` block in `upgrade` for every schema change. */
export const DB_VERSION = 1

const MEMBERS_STORE = 'members'
const WORKFLOWS_STORE = 'workflows'
const META_STORE = 'meta'
const SEEDED_KEY = 'seeded'

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
      upgrade(db, oldVersion) {
        // Migration path: each block upgrades the schema from the previous version.
        if (oldVersion < 1) {
          db.createObjectStore(MEMBERS_STORE, { keyPath: 'id' })
          db.createObjectStore(WORKFLOWS_STORE, { keyPath: 'id' })
          db.createObjectStore(META_STORE)
        }
        // if (oldVersion < 2) { ...future migration... }
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
 * Writes the seed members and sets the 'seeded' flag in a single transaction,
 * only when the flag is absent. Safe to call repeatedly: the flag check and the
 * writes share one readwrite transaction, so a refresh, a second tab or a
 * StrictMode double-mount never duplicates records.
 * Resolves to true if seed data was written by this call, false otherwise.
 */
export function seedIfNeeded(): Promise<boolean> {
  if (!seedPromise) {
    seedPromise = run('seed initial data', async (db) => {
      const tx = db.transaction([MEMBERS_STORE, META_STORE], 'readwrite')
      const flag = await tx.objectStore(META_STORE).get(SEEDED_KEY)
      if (flag === true) {
        await tx.done
        return false
      }
      const membersStore = tx.objectStore(MEMBERS_STORE)
      await Promise.all(seedMembers.map((member) => membersStore.put(member)))
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