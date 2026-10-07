import type { TeamMember } from '../types'

/**
 * Seed team members taken from the voicenote.
 * Ids are fixed so that seeding is idempotent: re-running the seed
 * overwrites the same records instead of creating duplicates.
 */
const SEED_CREATED_AT = '2026-10-07T00:00:00.000Z'

export const seedMembers: TeamMember[] = [
  {
    id: 'member-paul',
    name: 'Paul',
    role: 'Software developer',
    responsibilities: [
      'Builds IntentForge and PenEd',
      'Generates roadmaps in IntentForge',
      'Pushes project updates to GitHub',
      'Pulls, runs and tests the updated projects',
      'Fixes breaks by creating a new roadmap',
      'Issues campaign briefs to Bianca (alongside Shelly)',
    ],
    primaryApps: ['IntentForge', 'PenEd'],
    notes: '',
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'member-shelly',
    name: 'Shelly',
    role: 'UI/UX and design',
    responsibilities: [
      'Builds the lightweight UI design shell for the PenEd Tools admin and creator apps and the IntentForge client',
      'Her design changes trigger roadmap generation, one roadmap per affected system',
      'Issues campaign briefs to Bianca (alongside Paul)',
      "Helps design Dan's app",
    ],
    primaryApps: ['UI design shell', 'PenEd Tools', 'IntentForge client'],
    notes: '',
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'member-dan',
    name: 'Dan',
    role: 'Finance and operations',
    responsibilities: [
      'Builds the Invoice Capture app for supplier invoices',
      'Exports captured invoices to Excel',
      'Attaches invoices to jobs and tracks them',
      'Stock, services and accounting tracking (to be defined)',
    ],
    primaryApps: ['Invoice Capture'],
    notes: '',
    createdAt: SEED_CREATED_AT,
  },
  {
    id: 'member-bianca',
    name: 'Bianca',
    role: 'Marketing',
    responsibilities: [
      'Builds PenEd Marketing',
      'Starts campaigns from briefs received from Shelly or Paul',
      'Manages the hierarchical milestone list generated for each campaign',
    ],
    primaryApps: ['PenEd Marketing'],
    notes: 'PenEd Marketing is in its early phases.',
    createdAt: SEED_CREATED_AT,
  },
]