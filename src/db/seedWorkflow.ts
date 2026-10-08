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

/**
 * How an edge is routed: the side it leaves and arrives at, and pixel offsets.
 * sourceOffset and targetOffset slide the end point along its side. routeOffset moves the
 * middle segment away from the straight path: for a bottom-to-top edge it shifts the
 * horizontal run up or down from the lane boundary, for a left-to-left edge a negative
 * value runs the line that far into the left gutter, for a bottom-to-bottom edge a positive
 * value loops that far beneath the nodes, and for a top-to-top edge a negative value loops
 * that far above the nodes.
 */
type EdgeRoute = Pick<
  WorkflowEdge,
  'sourceSide' | 'targetSide' | 'sourceOffset' | 'targetOffset' | 'routeOffset'
>

/** Same-lane forward edge: leaves on the right and arrives on the left, as a straight line. */
const FORWARD: EdgeRoute = { sourceSide: 'right', targetSide: 'left' }

function edge(
  source: string,
  target: string,
  label: string,
  kind: WorkflowEdgeKind,
  style?: WorkflowEdgeStyle,
  route: EdgeRoute = {},
): WorkflowEdge {
  return {
    id: `edge-${source}--${target}`,
    source,
    target,
    label,
    kind,
    ...(style ? { style } : {}),
    ...route,
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
  edge('start', 'ds-shell', 'request', 'handoff', undefined, FORWARD),
  edge('ds-shell', 'ds-handoff', 'changes', 'handoff', undefined, FORWARD),
  edge('ds-handoff', 'ds-roadmaps', 'converted', 'trigger', undefined, FORWARD),
  // Cross-lane: leaves from the bottom and runs along the Design / IntentForge lane boundary.
  edge('ds-roadmaps', 'if-roadmap', 'roadmaps', 'handoff', undefined, {
    sourceSide: 'bottom',
    targetSide: 'top',
    routeOffset: 0,
  }),

  // START feeds the other lanes through one bus that runs down the left gutter.
  edge('start', 'pe-admin', '', 'data', undefined, {
    sourceSide: 'left',
    targetSide: 'left',
    routeOffset: -50,
  }),
  edge('start', 'fi-capture', '', 'data', undefined, {
    sourceSide: 'left',
    targetSide: 'left',
    routeOffset: -50,
  }),
  edge('start', 'mk-brief', '', 'data', undefined, {
    sourceSide: 'left',
    targetSide: 'left',
    routeOffset: -50,
  }),

  // IntentForge core chain
  edge('if-roadmap', 'if-ai', 'prompt', 'handoff', undefined, FORWARD),
  edge('if-ai', 'if-save', 'applied', 'data', undefined, FORWARD),
  edge('if-save', 'if-github', 'push', 'trigger', undefined, FORWARD),
  edge('if-github', 'if-test', 'pull', 'handoff', undefined, FORWARD),
  edge('if-test', 'if-breaks', 'result', 'data', undefined, FORWARD),
  edge('if-breaks', 'if-done', 'no: ship', 'trigger', undefined, FORWARD),
  // Backward same-lane feedback: loops beneath the nodes.
  edge('if-breaks', 'if-roadmap', 'yes: new roadmap', 'trigger', 'feedback', {
    sourceSide: 'bottom',
    targetSide: 'bottom',
    routeOffset: 40,
  }),

  // PenEd branch
  edge('pe-admin', 'pe-outcomes', 'lessons', 'data', undefined, FORWARD),
  edge('pe-outcomes', 'pe-creator', 'objectives', 'handoff', undefined, FORWARD),
  edge('pe-creator', 'pe-content-roadmap', 'creates', 'trigger', undefined, FORWARD),
  edge('pe-content-roadmap', 'pe-ai-shape', 'prompt + schemas', 'handoff', undefined, FORWARD),
  edge('pe-ai-shape', 'pe-lms', 'generates', 'data', undefined, FORWARD),
  // Cross-lane feedback: leaves from the bottom and runs along the PenEd / PenEdTools boundary.
  edge('pe-content-roadmap', 'pt-suggest', 'no tool fits', 'data', 'feedback', {
    sourceSide: 'bottom',
    targetSide: 'top',
    sourceOffset: -20,
    routeOffset: 0,
  }),

  // Tool pipeline
  edge('pt-suggest', 'pt-describe', 'suggested', 'handoff', undefined, FORWARD),
  edge('pt-describe', 'pt-roadmap', 'roadmap', 'trigger', undefined, FORWARD),
  edge('pt-roadmap', 'pt-files', 'run', 'trigger', undefined, FORWARD),
  edge('pt-files', 'pt-added', 'add', 'data', undefined, FORWARD),
  edge('pt-added', 'pt-prompt', 'schema', 'trigger', undefined, FORWARD),
  edge('pt-prompt', 'pe-content-roadmap', 'updated schemas', 'data', 'feedback', {
    sourceSide: 'top',
    targetSide: 'bottom',
    targetOffset: 20,
    routeOffset: 0,
  }),
  edge('pe-lms', 'pt-frame', 'display', 'data', undefined, {
    sourceSide: 'bottom',
    targetSide: 'top',
    routeOffset: 0,
  }),

  // Finance branch
  edge('fi-capture', 'fi-excel', 'export', 'data', undefined, FORWARD),
  edge('fi-excel', 'fi-attach', 'attach', 'handoff', undefined, FORWARD),
  edge('fi-attach', 'fi-services', 'future', 'data', undefined, FORWARD),

  // Marketing branch
  edge('mk-brief', 'mk-paste', 'paste', 'handoff', undefined, FORWARD),
  edge('mk-paste', 'mk-roadmap', 'kick off', 'trigger', undefined, FORWARD),
  edge('mk-roadmap', 'mk-milestones', 'generates', 'data', undefined, FORWARD),

  // Everything shipped is reviewed, and the review closes the loop.
  // The edges into the review step are spread along its top and bottom sides so they do not overlap.
  edge('if-done', 'review', '', 'data', undefined, {
    sourceSide: 'bottom',
    targetSide: 'top',
    routeOffset: 0,
  }),
  edge('pt-frame', 'review', '', 'data', undefined, {
    sourceSide: 'top',
    targetSide: 'bottom',
    targetOffset: -30,
    routeOffset: 0,
  }),
  edge('fi-services', 'review', '', 'data', undefined, {
    sourceSide: 'top',
    targetSide: 'bottom',
    targetOffset: 0,
    routeOffset: 0,
  }),
  edge('mk-milestones', 'review', '', 'data', undefined, {
    sourceSide: 'top',
    targetSide: 'bottom',
    targetOffset: 30,
    routeOffset: 0,
  }),
  // The final loop runs around the top of the diagram, back to START.
  edge('review', 'start', 'next request', 'trigger', 'feedback', {
    sourceSide: 'top',
    targetSide: 'top',
    routeOffset: -70,
  }),
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