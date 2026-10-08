import type {
  Workflow,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowEdgeStyle,
  WorkflowNode,
  WorkflowNodeShape,
  WorkflowNodeStatus,
  WorkflowNodeType,
} from '../types'

/**
 * Seed workflow mapping the full voicenote flow.
 * Ids are fixed so that seeding is idempotent: re-running the seed
 * overwrites the same record instead of creating a duplicate.
 * Vague areas of the voicenote are flagged with the 'needs-definition' status.
 */
export const SEED_WORKFLOW_ID = 'workflow-main'

/** Column and row pitch of the example flowchart. */
const COLUMN = 190
const ROW = 130
/** Top-left position of the first column and row, leaving room for the lane gutter. */
const ORIGIN_X = 160
const ORIGIN_Y = 85

function node(
  id: string,
  label: string,
  type: WorkflowNodeType,
  description: string,
  group: string,
  column: number,
  row: number,
  options: {
    ownerId?: string
    ownerLabel?: string
    status?: WorkflowNodeStatus
    shape?: WorkflowNodeShape
  } = {},
): WorkflowNode {
  return {
    id,
    label,
    type,
    description,
    group,
    lane: group,
    column,
    position: { x: ORIGIN_X + column * COLUMN, y: ORIGIN_Y + row * ROW },
    ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    ...(options.ownerLabel ? { ownerLabel: options.ownerLabel } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.shape ? { shape: options.shape } : {}),
  }
}

function edge(
  source: string,
  target: string,
  label: string,
  kind: WorkflowEdgeKind,
  style?: WorkflowEdgeStyle,
): WorkflowEdge {
  return {
    id: `edge-${source}--${target}`,
    source,
    target,
    label,
    kind,
    ...(style ? { style } : {}),
  }
}

const PAUL = 'member-paul'
const SHELLY = 'member-shelly'
const DAN = 'member-dan'
const BIANCA = 'member-bianca'

const nodes: WorkflowNode[] = [
  // Design: Shelly's design-to-roadmap process (row 0)
  node(
    'start',
    'START: new request',
    'process',
    'A design change, curriculum, tool idea, invoice or campaign brief enters the system.',
    'Design',
    0,
    0,
    { shape: 'terminal' },
  ),
  node(
    'ds-shell',
    'Edit UI shell',
    'process',
    'Shelly changes layouts in the lightweight UI shell of the client apps.',
    'Design',
    1,
    0,
    { ownerId: SHELLY },
  ),
  node(
    'ds-handoff',
    'Convert changes to roadmaps',
    'process',
    'Turns design changes into per-system roadmaps. Process not yet defined.',
    'Design',
    2,
    0,
    { ownerId: SHELLY, status: 'needs-definition' },
  ),
  node(
    'ds-roadmaps',
    'Roadmap per system',
    'artifact',
    'One roadmap for each affected system, such as front end and API.',
    'Design',
    3,
    0,
  ),

  // IntentForge: the build engine (row 1)
  node(
    'if-roadmap',
    'Create roadmap',
    'process',
    'A roadmap of goals and file-level tasks is created in IntentForge.',
    'IntentForge',
    0,
    1,
    { ownerId: PAUL },
  ),
  node(
    'if-ai',
    'Prompt AI, paste response',
    'process',
    'Prompt is copied to an AI and the response pasted back (manual copy-paste).',
    'IntentForge',
    1,
    1,
  ),
  node(
    'if-save',
    'Save updates to server',
    'system',
    'Generated project updates are saved to the IntentForge server.',
    'IntentForge',
    2,
    1,
  ),
  node(
    'if-github',
    'Push to GitHub',
    'system',
    'The updated project is pushed to GitHub.',
    'IntentForge',
    3,
    1,
  ),
  node(
    'if-test',
    'Pull, run and test',
    'process',
    'Paul pulls the project, runs it and tests it.',
    'IntentForge',
    4,
    1,
    { ownerId: PAUL },
  ),
  node(
    'if-breaks',
    'Breaks?',
    'decision',
    'If something breaks, a new roadmap is created to fix it. Otherwise the change ships.',
    'IntentForge',
    5,
    1,
    { ownerId: PAUL },
  ),
  node(
    'if-done',
    'Apps updated',
    'system',
    'PenEd, Invoice Capture and PenEd Marketing now match the change.',
    'IntentForge',
    6,
    1,
  ),

  // PenEd: admin and creator apps (row 2)
  node(
    'pe-admin',
    'Admin builds curriculum tree',
    'system',
    'The PenEd admin app builds curriculum, subject and lesson structure.',
    'PenEd',
    0,
    2,
    { ownerId: PAUL },
  ),
  node(
    'pe-outcomes',
    'AI splits lessons into outcomes',
    'process',
    'Each lesson is broken into outcomes and objectives by AI.',
    'PenEd',
    1,
    2,
  ),
  node(
    'pe-creator',
    'Creator receives lesson',
    'system',
    'The creator app receives the lesson with its outcomes and objectives.',
    'PenEd',
    2,
    2,
  ),
  node(
    'pe-content-roadmap',
    'Content roadmap with tool schemas',
    'process',
    'A content roadmap is built for the lesson, including schemas of available tools.',
    'PenEd',
    3,
    2,
  ),
  node(
    'pe-ai-shape',
    'AI returns shaped data',
    'process',
    'The AI returns content data shaped to match the tool schemas.',
    'PenEd',
    4,
    2,
  ),
  node(
    'pe-lms',
    'Content generated for LMS',
    'artifact',
    'The finished lesson content for the learning management system.',
    'PenEd',
    5,
    2,
  ),
  node(
    'review',
    'Review results, log feedback',
    'process',
    'Everything shipped is reviewed and feedback becomes the next request. This closes the loop.',
    'PenEd',
    7,
    2,
    { ownerId: PAUL },
  ),

  // PenEdTools: tool pipeline (row 3)
  node(
    'pt-suggest',
    'Suggest and describe tool',
    'process',
    'How new tools are suggested and described before becoming a roadmap. Not yet defined.',
    'PenEdTools',
    0,
    3,
    { status: 'needs-definition' },
  ),
  node(
    'pt-describe',
    'Admin describes tool',
    'process',
    'The admin describes the new tool in the admin app.',
    'PenEdTools',
    1,
    3,
    { ownerLabel: 'admin' },
  ),
  node(
    'pt-roadmap',
    'Appears as creator roadmap',
    'artifact',
    'The described tool shows up as a roadmap in the creator app.',
    'PenEdTools',
    2,
    3,
  ),
  node(
    'pt-files',
    'Run roadmap: tool files',
    'process',
    'Running the roadmap generates the files for the tool.',
    'PenEdTools',
    3,
    3,
  ),
  node(
    'pt-added',
    'Add to PenEdTools',
    'system',
    'The generated tool joins the PenEdTools collection.',
    'PenEdTools',
    4,
    3,
  ),
  node(
    'pt-prompt',
    'Prompt system picks up schema',
    'process',
    'The prompt system automatically updates with the new tool schema and feeds content generation.',
    'PenEdTools',
    5,
    3,
  ),
  node(
    'pt-frame',
    'Display content via frame',
    'artifact',
    'Generated content is displayed using the tool through a frame.',
    'PenEdTools',
    6,
    3,
  ),

  // Finance: Dan's Invoice Capture (row 4)
  node(
    'fi-capture',
    'Invoice Capture',
    'system',
    'Dan\'s app for capturing supplier invoices.',
    'Finance',
    0,
    4,
    { ownerId: DAN },
  ),
  node(
    'fi-excel',
    'Convert to Excel',
    'artifact',
    'Captured invoices become an Excel spreadsheet.',
    'Finance',
    1,
    4,
  ),
  node(
    'fi-attach',
    'Attach to job and accounts',
    'process',
    'Invoices are attached to a job and tracked.',
    'Finance',
    2,
    4,
    { ownerId: DAN },
  ),
  node(
    'fi-services',
    'Services, stock, tracking',
    'process',
    'Further services, stock and accounting tracking. Planned, not yet defined.',
    'Finance',
    3,
    4,
    { ownerId: DAN, status: 'needs-definition' },
  ),

  // Marketing: Bianca's PenEd Marketing (row 5)
  node(
    'mk-brief',
    'Campaign brief',
    'artifact',
    'A campaign brief issued by Shelly or Paul.',
    'Marketing',
    0,
    5,
    { ownerLabel: '@shelly / @paul' },
  ),
  node(
    'mk-paste',
    'Paste into PenEd Marketing',
    'process',
    'Bianca starts a campaign and pastes in the brief.',
    'Marketing',
    1,
    5,
    { ownerId: BIANCA },
  ),
  node(
    'mk-roadmap',
    'Roadmap builds milestones',
    'process',
    'A roadmap generates the milestone list for the campaign.',
    'Marketing',
    2,
    5,
  ),
  node(
    'mk-milestones',
    'Milestone hierarchy',
    'artifact',
    'The campaign milestones, organised as a hierarchy.',
    'Marketing',
    3,
    5,
    { ownerId: BIANCA },
  ),
]

const edges: WorkflowEdge[] = [
  // Design branch
  edge('start', 'ds-shell', 'request', 'handoff'),
  edge('ds-shell', 'ds-handoff', 'changes', 'handoff'),
  edge('ds-handoff', 'ds-roadmaps', 'converted', 'trigger'),
  edge('ds-roadmaps', 'if-roadmap', 'roadmaps', 'handoff'),

  // START feeds the other lanes
  edge('start', 'pe-admin', '', 'data'),
  edge('start', 'fi-capture', '', 'data'),
  edge('start', 'mk-brief', '', 'data'),

  // IntentForge core chain
  edge('if-roadmap', 'if-ai', 'prompt', 'handoff'),
  edge('if-ai', 'if-save', 'applied', 'data'),
  edge('if-save', 'if-github', 'push', 'trigger'),
  edge('if-github', 'if-test', 'pull', 'handoff'),
  edge('if-test', 'if-breaks', 'result', 'data'),
  edge('if-breaks', 'if-done', 'no: ship', 'trigger'),
  edge('if-breaks', 'if-roadmap', 'yes: new roadmap', 'trigger', 'feedback'),

  // PenEd branch
  edge('pe-admin', 'pe-outcomes', 'lessons', 'data'),
  edge('pe-outcomes', 'pe-creator', 'objectives', 'handoff'),
  edge('pe-creator', 'pe-content-roadmap', 'creates', 'trigger'),
  edge('pe-content-roadmap', 'pe-ai-shape', 'prompt + schemas', 'handoff'),
  edge('pe-ai-shape', 'pe-lms', 'generates', 'data'),
  edge('pe-content-roadmap', 'pt-suggest', 'no tool fits', 'data', 'feedback'),

  // Tool pipeline
  edge('pt-suggest', 'pt-describe', 'suggested', 'handoff'),
  edge('pt-describe', 'pt-roadmap', 'roadmap', 'trigger'),
  edge('pt-roadmap', 'pt-files', 'run', 'trigger'),
  edge('pt-files', 'pt-added', 'add', 'data'),
  edge('pt-added', 'pt-prompt', 'schema', 'trigger'),
  edge('pt-prompt', 'pe-content-roadmap', 'updated schemas', 'data', 'feedback'),
  edge('pe-lms', 'pt-frame', 'display', 'data'),

  // Finance branch
  edge('fi-capture', 'fi-excel', 'export', 'data'),
  edge('fi-excel', 'fi-attach', 'attach', 'handoff'),
  edge('fi-attach', 'fi-services', 'future', 'data'),

  // Marketing branch
  edge('mk-brief', 'mk-paste', 'paste', 'handoff'),
  edge('mk-paste', 'mk-roadmap', 'kick off', 'trigger'),
  edge('mk-roadmap', 'mk-milestones', 'generates', 'data'),

  // Everything shipped is reviewed, and the review closes the loop
  edge('if-done', 'review', '', 'data'),
  edge('pt-frame', 'review', '', 'data'),
  edge('fi-services', 'review', '', 'data'),
  edge('mk-milestones', 'review', '', 'data'),
  edge('review', 'start', 'next request', 'trigger', 'feedback'),
]

export const seedWorkflow: Workflow = {
  id: SEED_WORKFLOW_ID,
  name: 'Company workflow',
  version: 2,
  // Fixed on purpose: a value taken from the clock would make every seed write differ.
  updatedAt: '2026-10-08T00:00:00.000Z',
  nodes,
  edges,
}