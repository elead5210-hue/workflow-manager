# Agent Brief: Workflow Manager

## Purpose

Workflow Manager is a visual workflow and team-roles manager. It exists to clarify how the company's systems and people fit together. It has two views:

- A **Workflow** page that renders the company's process as a flow diagram.
- A **Team** page that lists the team members, their roles and the apps they own.

The workflow and team data are stored locally in IndexedDB. On first load the database is seeded with the workflow and the team members described below. Parts of the process are still vague, so the app should make those gaps visible rather than hide them, and the data should be easy to edit as things get clarified.

## Team Members and Roles

### Paul
- Software developer.
- Builds IntentForge and PenEd.
- Generates roadmaps in IntentForge, pushes project updates to GitHub, pulls them onto his machine, runs and tests them, and generates new roadmaps to fix any breaks.
- Provides campaign briefs to Bianca (alongside Shelly).

### Shelly
- UI/UX and design.
- Builds a lightweight UI design app: a shell of the layout elements used in the PenEd Tools admin and creator apps, and also the IntentForge client. It may later cover the other apps as well.
- Can switch between the client apps and view basic page layouts in their current state. The shell does not render data.
- Her design changes trigger a process that produces one roadmap per system that needs updating (for example, a front-end roadmap and an API roadmap).
- Also provides campaign briefs to Bianca.
- Helps design Dan's app.

### Dan
- Finance and operations.
- Builds the Invoice Capture app (the name is not certain), which captures supplier invoices, converts them into an Excel spreadsheet and attaches them to a job for tracking.
- Will also track stock, services and the accounting side. The detail of this is not yet defined.
- His app is built through IntentForge, and Shelly's design updates generate roadmaps that update it.

### Bianca
- Marketing.
- Builds PenEd Marketing, which manages the marketing of the PenEd system.
- Starts a new campaign, pastes in the campaign brief she receives from Shelly or Paul, and a roadmap generates a hierarchical milestone list of what must be accomplished to complete the campaign.
- This app is in its early phases.

## Workflow

### 1. IntentForge (the build engine)
IntentForge is a React project with an API. It is used to build the company's other apps.

1. A roadmap is generated and saved to IntentForge.
2. The roadmap is processed with a prompting system. A prompt is generated, an AI responds (a copy-paste flow), and the resulting updates are saved to the project.
3. The project is saved to a server connected to GitHub, so updates can be pushed from there.
4. Paul pulls the pushed project onto his machine, runs it and tests it.
5. If anything is broken, a new roadmap is generated to fix it. This repeats until the project works.

IntentForge can generate React projects, back-end APIs and Next.js websites.

### 2. PenEd (the learning management system)
PenEd is the product the company intends to make money from. It has an API, an administrator app and a creator app.

**Administrator app**
1. Uses a similar copy-paste AI flow to build hierarchical tree data that breaks a curriculum down to subjects and lessons.
2. AI then breaks each lesson down into outcomes and objectives.
3. This is as far as the administrator goes.

**Creator app**
1. Once a lesson has been saved with its outcomes and objectives, the creator can see them.
2. The creator kicks off a roadmap that generates content for the lesson, using the same copy-paste prompting approach.
3. The prompt gives the AI the lesson context and a list of available tools along with the schemas for the data shapes they consume.
4. The AI replies with data in the correct shape, and the tool generates the content for the learning management system.

### 3. PenEdTools (the tool pipeline)
PenEdTools is a larger project holding the list of tools that can consume AI-generated content.

1. An administrator describes a new tool for consuming AI content.
2. Once saved, the description appears in the creator app as a roadmap.
3. The creator runs that roadmap the same way as the content creation pipeline, and it generates the files to build the new tool.
4. When the tool is built and finalised, it is pulled into PenEdTools.
5. The prompting system updates automatically, so the new tool and its schema are included whenever creators generate content. This feeds back into the content creation pipeline.
6. When content is complete, the tool is pulled from PenEdTools via a frame and displays the content.

This pipeline is still vague. In particular, the tool suggestion process needs definition.

### 4. Design to roadmap (Shelly)
1. Shelly edits layouts, adds components and changes elements in the lightweight UI design app.
2. A process then converts her changes into a list of roadmaps, one for each system that needs updating (for example, front end and API).
3. The roadmaps are run in IntentForge, which updates the affected apps: PenEd, Invoice Capture and PenEd Marketing.

The handoff from Shelly's design changes to generated roadmaps still needs to be defined.

### 5. Invoice Capture (Dan)
1. Supplier invoices are captured.
2. They are converted into an Excel spreadsheet.
3. They are attached to a job and tracked.
4. Further services, stock and accounting tracking will be added, which are not yet defined.

### 6. PenEd Marketing (Bianca)
1. Bianca starts a new campaign.
2. She receives a campaign brief from Shelly or Paul and pastes it in.
3. A roadmap is kicked off that builds a hierarchical milestone list of what needs to be accomplished to complete the campaign.

## Open Questions (Needs Definition)

- How tools are suggested and described before they become roadmaps.
- How Shelly's design changes are turned into per-system roadmaps.
- What exactly Dan will track beyond invoices (services, stock, accounting).
- The confirmed name of Dan's app (currently "Invoice Capture").
- How Bianca's campaign milestones are tracked and completed after generation.