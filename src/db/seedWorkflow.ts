import type {
  Workflow,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowNode,
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

const COLUMN = 280
const ROW = 300

function node(
  id: string,
  label: string,
  type: WorkflowNodeType,
  description: string,
  group: string,
  column: number,
  row: number,
  options: { ownerId?: string; status?: WorkflowNodeStatus } = {},
): WorkflowNode {
  return {
    id,
    label,
    type,
    description,
    group,
    position: { x: column * COLUMN, y: row * ROW },
    ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    ...(options.status ? { status: options.status } : {}),
  }
}

function edge(
  source: string,
  target: string,
  label: string,
  kind: WorkflowEdgeKind,
): WorkflowEdge {
  return { id: `edge-${source}--${target}`, source, target, label, kind }
}

const PAUL = 'member-paul'
const SHELLY = 'member-shelly'
const DAN = 'member-dan'
const BIANCA = 'member-bianca'

const nodes: WorkflowNode[] = [
  // IntentForge: the build engine
  node(
    'if-roadmap',
    'Roadmap created in IntentForge',
    'process',
    'A roadmap of goals and file-level tasks is created in IntentForge.',
    'IntentForge',
    0,
    0,
    { ownerId: PAUL },
  ),
  node(
    'if-ai',
    'AI prompt and response',
    'process',
    'A prompt is copied to an AI and the response is pasted back into IntentForge (manual copy-paste).',
    'IntentForge',
    1,
    0,
  ),
  node(
    'if-save',
    'Project updates saved to server',
    'system',
    'The generated project updates are saved to the IntentForge server.',
    'IntentForge',
    2,
    0,
  ),
  node(
    'if-github',
    'Pushed to GitHub',
    'system',
    'The updated project is pushed to GitHub.',
    'IntentForge',
    3,
    0,
  ),
  node(
    'if-test',
    'Paul pulls, runs and tests',
    'process',
    'Paul pulls the project from GitHub, runs it and tests it.',
    'IntentForge',
    4,
    0,
    { ownerId: PAUL },
  ),
  node(
    'if-breaks',
    'Does it break?',
    'decision',
    'If something breaks a new roadmap is created to fix it; otherwise the change is done.',
    'IntentForge',
    5,
    0,
    { ownerId: PAUL },
  ),
  node(
    'if-done',
    'Done',
    'artifact',
    'The change works and is complete.',
    'IntentForge',
    6,
    0,
  ),

  // PenEd: admin and creator apps
  node(
    'pe-admin',
    'Admin app builds curriculum tree',
    'system',
    'The PenEd admin app is used to build the curriculum structure.',
    'PenEd',
    0,
    1,
    { ownerId: PAUL },
  ),
  node(
    'pe-tree',
    'Curriculum, subject and lesson tree',
    'artifact',
    'The curriculum tree: curriculum, then subject, then lesson.',
    'PenEd',
    1,
    1,
  ),
  node(
    'pe-outcomes',
    'AI breaks lessons into outcomes and objectives',
    'process',
    'Each lesson is broken down by AI into outcomes and objectives.',
    'PenEd',
    2,
    1,
  ),
  node(
    'pe-creator',
    'Creator app receives lesson',
    'system',
    'The PenEd creator app receives the lesson with its outcomes and objectives.',
    'PenEd',
    3,
    1,
  ),
  node(
    'pe-content-roadmap',
    'Content roadmap with tool schemas',
    'process',
    'A content roadmap is built for the lesson, including the schemas of the available tools.',
    'PenEd',
    4,
    1,
  ),
  node(
    'pe-ai-shape',
    'AI returns correctly shaped data',
    'process',
    'The AI returns content data shaped to match the tool schemas.',
    'PenEd',
    5,
    1,
  ),
  node(
    'pe-lms',
    'Content generated for the LMS',
    'artifact',
    'The generated lesson content for the learning management system.',
    'PenEd',
    6,
    1,
  ),

  // PenEdTools: tool pipeline
  node(
    'pt-suggest',
    'Tool suggestion and description',
    'process',
    'How new tools are suggested and described before they become a roadmap is not yet defined.',
    'PenEdTools',
    0,
    2,
    { status: 'needs-definition' },
  ),
  node(
    'pt-describe',
    'Admin describes a new tool',
    'process',
    'The admin describes a new tool in the admin app.',
    'PenEdTools',
    1,
    2,
  ),
  node(
    'pt-roadmap',
    'Tool appears as a roadmap in Creator app',
    'artifact',
    'The described tool shows up as a roadmap in the creator app.',
    'PenEdTools',
    2,
    2,
  ),
  node(
    'pt-files',
    'Roadmap generates tool files',
    'process',
    'Running the roadmap generates the files for the tool.',
    'PenEdTools',
    3,
    2,
  ),
  node(
    'pt-added',
    'Tool added to PenEdTools',
    'system',
    'The generated tool is added to the PenEdTools collection.',
    'PenEdTools',
    4,
    2,
  ),
  node(
    'pt-prompt',
    'Prompt system updates with tool schema',
    'process',
    'The prompt system automatically picks up the new tool schema, which feeds back into content generation.',
    'PenEdTools',
    5,
    2,
  ),
  node(
    'pt-frame',
    'Content displayed via frame',
    'artifact',
    'Generated content is displayed using the tool through a frame.',
    'PenEdTools',
    6,
    2,
  ),

  // Design: Shelly's design-to-roadmap process
  node(
    'ds-shell',
    'Shelly edits the lightweight UI shell',
    'process',
    'Shelly changes the layouts in the lightweight UI design shell of the client apps.',
    'Design',
    0,
    3,
    { ownerId: SHELLY },
  ),
  node(
    'ds-handoff',
    'Changes converted into roadmaps',
    'process',
    'How design changes are turned into per-system roadmaps is not yet defined.',
    'Design',
    1,
    3,
    { ownerId: SHELLY, status: 'needs-definition' },
  ),
  node(
    'ds-roadmaps',
    'One roadmap per affected system',
    'artifact',
    'A separate roadmap for each affected system, such as the front end and the API.',
    'Design',
    2,
    3,
  ),
  node(
    'ds-run',
    'Run in IntentForge',
    'process',
    'The generated roadmaps are run in IntentForge.',
    'Design',
    3,
    3,
    { ownerId: PAUL },
  ),
  node(
    'ds-apps',
    'Apps updated',
    'system',
    'PenEd, Invoice Capture and PenEd Marketing are updated to match the design.',
    'Design',
    4,
    3,
  ),

  // Finance: Dan's Invoice Capture
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
    'Invoices converted to Excel',
    'artifact',
    'Captured invoices are converted into an Excel spreadsheet.',
    'Finance',
    1,
    4,
  ),
  node(
    'fi-attach',
    'Attached to jobs and accounting',
    'process',
    'Invoices are attached to a job and tracked.',
    'Finance',
    2,
    4,
    { ownerId: DAN },
  ),
  node(
    'fi-services',
    'Services, stock and accounting tracking',
    'process',
    'Further services, stock and accounting tracking are planned but not yet defined.',
    'Finance',
    3,
    4,
    { ownerId: DAN, status: 'needs-definition' },
  ),

  // Marketing: Bianca's PenEd Marketing
  node(
    'mk-brief',
    'Campaign brief from Shelly or Paul',
    'artifact',
    'A campaign brief issued by Shelly or Paul.',
    'Marketing',
    0,
    5,
  ),
  node(
    'mk-paste',
    'Bianca pastes brief into PenEd Marketing',
    'process',
    'Bianca starts a new campaign in PenEd Marketing and pastes in the brief.',
    'Marketing',
    1,
    5,
    { ownerId: BIANCA },
  ),
  node(
    'mk-roadmap',
    'Roadmap generates milestone list',
    'process',
    'A roadmap is kicked off that builds a hierarchical milestone list for the campaign.',
    'Marketing',
    2,
    5,
  ),
  node(
    'mk-milestones',
    'Hierarchical milestone list',
    'artifact',
    'The campaign milestones, organised as a hierarchy.',
    'Marketing',
    3,
    5,
    { ownerId: BIANCA },
  ),
]

const edges: WorkflowEdge[] = [
  // IntentForge core chain
  edge('if-roadmap', 'if-ai', 'Prompt', 'handoff'),
  edge('if-ai', 'if-save', 'Response applied', 'data'),
  edge('if-save', 'if-github', 'Push', 'trigger'),
  edge('if-github', 'if-test', 'Pull', 'handoff'),
  edge('if-test', 'if-breaks', 'Test result', 'data'),
  edge('if-breaks', 'if-done', 'No', 'trigger'),
  edge('if-breaks', 'if-roadmap', 'Yes: new roadmap', 'trigger'),

  // PenEd branch
  edge('pe-admin', 'pe-tree', 'Builds', 'data'),
  edge('pe-tree', 'pe-outcomes', 'Lessons', 'data'),
  edge('pe-outcomes', 'pe-creator', 'Lesson with objectives', 'handoff'),
  edge('pe-creator', 'pe-content-roadmap', 'Creates', 'trigger'),
  edge('pe-content-roadmap', 'pe-ai-shape', 'Prompt with schemas', 'handoff'),
  edge('pe-ai-shape', 'pe-lms', 'Generates', 'data'),

  // Tool pipeline
  edge('pt-suggest', 'pt-describe', 'Suggested tool', 'handoff'),
  edge('pt-describe', 'pt-roadmap', 'Appears as roadmap', 'trigger'),
  edge('pt-roadmap', 'pt-files', 'Run roadmap', 'trigger'),
  edge('pt-files', 'pt-added', 'Add tool', 'data'),
  edge('pt-added', 'pt-prompt', 'New tool schema', 'trigger'),
  edge('pt-prompt', 'pe-content-roadmap', 'Feedback: updated schemas', 'data'),
  edge('pe-lms', 'pt-frame', 'Displayed', 'data'),

  // Design branch
  edge('ds-shell', 'ds-handoff', 'Design changes', 'handoff'),
  edge('ds-handoff', 'ds-roadmaps', 'Converted', 'trigger'),
  edge('ds-roadmaps', 'ds-run', 'Roadmaps', 'handoff'),
  edge('ds-run', 'if-roadmap', 'Runs in IntentForge', 'trigger'),
  edge('ds-run', 'ds-apps', 'Updates', 'data'),

  // Finance branch
  edge('fi-capture', 'fi-excel', 'Export', 'data'),
  edge('fi-excel', 'fi-attach', 'Attach', 'handoff'),
  edge('fi-attach', 'fi-services', 'Future tracking', 'data'),

  // Marketing branch
  edge('mk-brief', 'mk-paste', 'Paste brief', 'handoff'),
  edge('mk-paste', 'mk-roadmap', 'Kick off roadmap', 'trigger'),
  edge('mk-roadmap', 'mk-milestones', 'Generates', 'data'),
]

export const seedWorkflow: Workflow = {
  id: SEED_WORKFLOW_ID,
  name: 'Company workflow',
  version: 1,
  nodes,
  edges,
}