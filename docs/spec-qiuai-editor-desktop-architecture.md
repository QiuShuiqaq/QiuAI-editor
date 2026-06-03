# Spec: QiuAI-editor Desktop Architecture

## Assumptions
1. `QiuAI-editor` is a pure desktop application, and Electron is the final desktop shell.
2. The product target is project-report writing, especially Chinese research and申报书-style documents.
3. `DeepSeek` is the primary authoring model for正文写作, but not the only model in the system.
4. Other models may be used, but they must not directly own global document coherence.
5. `PaperSpine` will be integrated as a text-quality enhancement layer for the authoring flow, not as the editor core and not as an independent free-writing model.
6. Existing repository code is a valid prototype base and should be evolved, not rewritten from scratch unless a boundary demands it.

## Objective
Build `QiuAI-editor` into a pure desktop, Word-like report editor with a unified document state and controlled multi-model orchestration.

The core product goal is:
- let users edit long-form reports like Word
- preserve whole-document coherence across AI-assisted writing
- keep `DeepSeek` as the main writing model for正文生成
- use other models only as bounded specialists
- improve output quality through `PaperSpine` before text reaches the final writing model

Primary users:
- users writing research project applications
- users writing formal Chinese reports with strong structure, terminology, and data consistency requirements

Success means:
- the app starts as a real Electron desktop app
- one document has one authoritative global state
- AI writing uses global context instead of isolated task-local prompts
- `DeepSeek` writes the final正文 for a section
- specialist models return structured outputs or suggestions only
- editor content, document state, and export results stay consistent

## Tech Stack
- Desktop shell: Electron
- Frontend: React 18 + Vite + TypeScript
- Editor core: Tiptap / ProseMirror
- State management: Zustand
- Shared contracts: workspace package `@qiuai/shared`
- Packaging: electron-builder
- AI orchestration: main-process service layer
- Author model: DeepSeek via OpenAI-compatible API
- Specialist models: configurable OpenAI-compatible / Anthropic / Ollama providers
- Text-quality enhancement: `PaperSpine` integrated into prompt/context preparation layer

## Commands
Current repository commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm lint
```

Target commands after architecture convergence:

```bash
pnpm install
pnpm dev:desktop
pnpm build
pnpm test
pnpm lint
pnpm package
```

Expected meanings:
- `pnpm dev:desktop`: start renderer dev server and Electron main process together
- `pnpm build`: build `shared`, `renderer`, and `main`
- `pnpm package`: produce Windows desktop installer artifacts

## Project Structure
Current high-value structure:

```text
packages/main/        Electron main process, IPC, filesystem, model orchestration
packages/renderer/    React UI, Tiptap editor, dialogs, panels, local UI state
packages/shared/      shared types, IPC channels, document contracts, utilities
scripts/              launcher and developer scripts
docs/                 specs, ADRs, architecture notes
```

Target architecture additions:

```text
packages/main/src/ai/
  orchestrator/       authoring pipeline, context assembly, model routing
  providers/          model provider adapters
  paperspine/         PaperSpine integration and adapters
  memory/             document state compression, summaries, terminology, facts

packages/main/src/services/
  documentState/      persistent authoritative document state
  export/             docx/pdf export pipeline

packages/shared/src/
  document/           document-state interfaces and task contracts
  ai/                 structured request/response types for model tasks
```

## Architecture

### 1. Single Source of Truth
The system must maintain one authoritative `DocumentState` for each document. The editor JSON alone is not enough.

`DocumentState` should include:
- document metadata
- outline tree
- current editor content
- section summaries
- terminology glossary
- facts and numeric claims
- reference chunks
- citation links
- writing rules and style profile
- unresolved review items
- model task history

The editor renders and edits content, but global coherence is managed by `DocumentState`.

### 2. Model Roles
Model usage is role-based, not globally interchangeable.

- `AuthorModel`
  - default: `DeepSeek`
  - responsibility: generate or rewrite final section正文
  - receives full assembled context package
  - is the only model allowed to directly produce final prose for the document body

- `AnalystModel`
  - responsibility: read materials, summarize sources, detect conflicts, extract facts, suggest gaps
  - output must be structured JSON or bounded summaries
  - must not directly replace main正文

- `UtilityModels`
  - responsibility: image generation, OCR, table normalization, CSV cleanup, similar narrow tasks
  - output must remain task-bounded

### 3. Orchestration Rule
Multiple models may participate in one writing flow, but all of them operate through one orchestrator.

The orchestrator must:
- read `DocumentState`
- prepare a task-scoped context package
- call specialist models for bounded preprocessing
- merge returned structured results back into `DocumentState`
- call `DeepSeek` as the final authoring step
- return draft text plus trace metadata

This avoids the failure mode where separate models only know their local task and produce fragmented writing.

### 4. PaperSpine Placement
`PaperSpine` should be placed before final authoring.

It should be used for:
- source organization
- section-level context stitching
- writing constraint assembly
- prompt enhancement
- report-style quality shaping

It should not:
- replace the editor
- own the entire persistence layer
- become an uncontrolled second author

Recommended flow:

```text
Reference Materials
  -> DocumentState memory build
  -> PaperSpine enhancement
  -> DeepSeek authoring
  -> Editor insertion
  -> summary/fact/glossary refresh
```

### 5. Desktop Boundary
The app must converge to one desktop runtime path:
- Electron main process owns filesystem, export, IPC, and AI orchestration
- renderer must stop directly calling model APIs for core authoring flows
- browser-app launcher remains temporary only if needed for development, not as the product runtime

### 6. Output Boundary
Exports must be derived from the authoritative document state and editor content together.

- DOCX export must preserve headings, paragraphs, tables, and basic formatting
- PDF export must generate real PDF, not only HTML fallback
- review marks and unresolved fact checks should be export-aware

## Code Style
Prefer explicit typed contracts and role-based service boundaries.

Example:

```ts
export interface AuthoringContextPacket {
  documentId: string;
  sectionId: string;
  sectionTitle: string;
  outlinePath: string[];
  documentSummary: string;
  sectionSummaries: string[];
  terminology: Array<{ term: string; definition: string }>;
  facts: Array<{ key: string; value: string; sourceIds: string[] }>;
  references: Array<{ id: string; text: string; sourceId: string }>;
  writingRules: string[];
}
```

Conventions:
- keep renderer logic UI-focused
- move AI and filesystem side effects into `packages/main`
- use structured types instead of free-form objects for cross-process payloads
- prefer additive refactors over rewrites

## Testing Strategy
- Unit tests for document-state reducers, context assembly, and model-routing logic
- Unit tests for PaperSpine adapter behavior
- Integration tests for IPC handlers and draft persistence
- Manual verification for editor interactions and export behavior

Minimum coverage focus:
- authoring context assembly correctness
- role-based model routing correctness
- draft save/open consistency
- DOCX and PDF export happy paths

Verification commands:

```bash
pnpm test
pnpm build
```

Manual checks:
- create a draft
- import reference material
- generate one section with DeepSeek
- run one specialist-model analysis task
- verify returned structured data updates document state
- export DOCX and PDF

## Boundaries
- Always:
  - keep one authoritative document state
  - route final正文 generation through `DeepSeek`
  - keep specialist models bounded to structured outputs or explicit suggestions
  - store filesystem and AI secrets outside renderer UI state when possible
  - preserve existing user-visible writing data during refactors

- Ask first:
  - adding a database
  - replacing Electron with another desktop stack
  - introducing a new document storage format that breaks old drafts
  - adding paid external services beyond current model-provider scope

- Never:
  - let multiple models independently overwrite full document sections without orchestration
  - treat editor HTML/JSON as the only source of truth for document intelligence
  - ship fake PDF export as the final behavior
  - hardcode secrets into the repository

## Success Criteria
- The repository has one primary Electron desktop startup path.
- Root build includes `main`, `renderer`, and `shared`.
- A new `DocumentState` contract exists and is persisted with drafts.
- The main authoring pipeline runs through orchestrator -> PaperSpine enhancement -> DeepSeek authoring.
- Specialist-model tasks write back structured outputs, not uncontrolled prose.
- Renderer no longer directly owns core authoring model calls.
- DeepSeek is configured as the default `AuthorModel` for正文 generation.
- Existing prototype editing capabilities remain usable after refactor.

## Open Questions
- Should specialist-model suggestions appear as inline tracked changes, side-panel suggestions, or manual insert actions?
- Should long-document summaries be regenerated eagerly on every change or lazily per authoring task?
- Should `PaperSpine` run fully local inside the app codebase, or as a wrapped service/module with its own update boundary?
