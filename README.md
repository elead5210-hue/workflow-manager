# Workflow Manager

Workflow Manager is a visual workflow and team-roles management app. It shows the company's closed-loop process as a swimlane flowchart, lists the team members and their roles, tracks the client apps, and lets you export and import all of this data as a JSON file. Everything is stored locally in the browser using IndexedDB, so no server is needed.

## Getting started

Install the dependencies:

```bash
npm install
```

Build the app (this runs `tsc -b && vite build`):

```bash
npm run build
```

To work on the app locally, use the scripts defined in `package.json`; the project is built with Vite, React and TypeScript.

## Pages

The app is routed in `src/App.tsx` and wrapped in a shared layout and data provider. It has four pages:

- **Workflow** (`src/features/workflow`): the flowchart of the process, drawn with swimlanes, custom node shapes and labelled edges. You can add, edit, move and delete nodes and edges, and view details of the selected step.
- **Team** (`src/features/team`): the team members and their roles, with a form to add and edit members.
- **Apps** (`src/features/apps`): the tracked apps, with a form to add and edit them.
- **Data** (`src/features/data`): facts about the current workflow, JSON export and import, and a history of saved snapshots that can be compared and restored.

## Project structure

- `src/main.tsx`, `src/App.tsx`: application entry point and routes.
- `src/components`: shared UI such as the page layout and the modal dialog.
- `src/features`: one folder per page (workflow, team, apps, data).
- `src/data`: the shared data layer used by the pages.
- `src/db`: IndexedDB access and the seed data.
- `src/types`: shared TypeScript types.
- `src/styles/global.css`: global styles and the light and dark theme colour tokens.

## Workflow page

The workflow page lives in `src/features/workflow`:

- `WorkflowPage.tsx`: the page itself, built on `@xyflow/react`, including selection, editing and the minimap and controls.
- `flowMapping.ts`: converts between the stored workflow and the flow diagram, and builds the swimlanes.
- `WorkflowNodes.tsx`: the node cards and swimlane bands.
- `WorkflowEdges.tsx`: the custom edge component that draws labelled step lines with arrowheads.
- `WorkflowLegend.tsx`: the legend.
- `NodeDetailsPanel.tsx`: details and edit controls for the selected step.
- `WorkflowPage.css`: styles for the page.

The file `src/features/workflow/updatedWorkflowExample/workflow-example.html` is the reference flowchart the workflow page is styled after.

## Data layer (IndexedDB)

- `src/db/index.ts` opens the IndexedDB database (using the `idb` library), defines its stores and runs version upgrades.
- `src/db/seedWorkflow.ts` and `src/db/seedMembers.ts` hold the initial workflow and team members that are stored the first time the app runs, or when the data is reset to the seed data.
- `src/data/DataProvider.tsx` loads members, apps, the workflow and its snapshots from IndexedDB and holds them as the shared state. Every change is written to IndexedDB first.
- `src/data/dataContext.ts` defines the context and its types, and `src/data/hooks.ts` provides the hooks the pages use (`useMembers`, `useApps`, `useWorkflow` and `useSnapshots`).
- `src/data/snapshotDiff.ts` compares two versions of a workflow and summarises what was added, removed or changed.

## JSON export and import

The Data page can download all workflow and team data as a JSON file and load such a file back in.

- `src/data/exportImport.ts` builds and serializes the export bundle and parses and validates an imported file. Parsing never throws; it returns either the validated bundle or a list of plain-language problems that are shown on the Data page.
- `src/features/data/fileTransfer.ts` handles the file download and upload in the browser.

## More information

`agent-brief.md` describes the purpose of the app, the team members and their roles, the workflow steps, and the open questions that still need a definition.