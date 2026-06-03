# Spec: Current Editor Engine Full Adaptation

## Date
2026-06-02

## Status
Accepted

## Goal
Make the current `document-core-preview` path the real primary editor platform for `QiuAI-editor`, so product features no longer depend on legacy TipTap assumptions.

The target experience is:

- Users feel they are editing a formal document first, with AI as an enhancement layer.
- Save, export, AI read/write, page state, and document state all point to the same primary content source.
- Ribbon, task panes, status bar, outline, review, and citation features adapt to the active editor engine through one shared contract.

## Why This Needs A Real Migration
The current codebase is in a mixed state:

- `document-core-preview` is the default engine.
- Many features still read from or write to TipTap directly.
- Save and export still have legacy paths that can diverge from the current visual document.
- Capability checks are scattered as `kind === 'document-core-preview'` and UI fallbacks are inconsistent.

That means adding more feature patches on top of the current state will increase fragmentation instead of reducing it.

## Product Decision
We will not treat the current engine as a temporary preview anymore.

Instead:

- `document-core-preview` becomes the main document authoring platform.
- `legacy-tiptap` becomes a compatibility path during migration.
- New feature work must bind to the shared document engine contract first.
- Direct feature access to TipTap should be treated as migration debt.

## Core Principle
There must be one editor-facing platform contract and one primary document truth.

### One Platform Contract
All product features should talk to the active document engine through a shared adapter layer instead of branching on editor implementation details.

### One Primary Document Truth
In `document-core-preview` mode, the primary authoring source is the file-backed working document, not legacy `editorContent`.

This affects:

- save
- autosave
- export
- AI insert and rewrite
- document reopen
- status reporting

## Required Adapter Surface
The adapter must grow from a command relay into a product platform interface.

### P0: Must Exist First

- `getStatus`
- `getSelection`
- `replaceSelection`
- `saveDocument`
- `executeCommand`
- `findInDocument`
- `replaceInDocument`
- `capabilities`

### P1: Needed For Word-First UX

- `getOutlineSnapshot`
- `getCurrentFormattingSnapshot`
- `getActiveObjectSnapshot`
- `setPageLayout`
- `setHeaderFooterMode`
- `insertImage`
- `insertTable`

### P2: Needed For Full Product Parity

- `getRevisionSnapshot`
- `applyRevisionAction`
- `insertCitation`
- `insertCrossReference`
- `refreshTableOfContents`

## Capability Model
Every engine adapter must expose explicit capabilities instead of forcing UI code to infer behavior from engine kind.

Initial capabilities:

- `selectionRead`
- `selectionWrite`
- `commandExecution`
- `findReplace`
- `visualSelectionToolbar`
- `paragraphFormatting`
- `structuralNavigation`
- `revisionTracking`
- `primaryFileSource`

Rules:

- UI must decide by capability, not by engine name.
- Unsupported features must be hidden or disabled clearly.
- No button should remain clickable if the active engine cannot apply it.

## Data Truth Rules

### In Preview Engine Mode

- The file-backed authoring source is the primary content source.
- Export must prefer the file-backed source or its synchronized snapshot.
- Save must persist the same source that the user is actively editing.
- AI preview/apply must operate against the same active selection and document source.

### In Legacy Mode

- `editorContent` remains the primary source.
- Legacy save/export may continue temporarily.

## Migration Plan

### Phase 1: Contract Consolidation

- Introduce shared engine capabilities.
- Replace scattered `kind === ...` checks with capability helpers.
- Centralize product-facing engine labels and status text.
- Mark all direct TipTap-only feature entry points as migration debt.

### Phase 2: Primary Content Unification

- Make preview-mode save/export read from the same file-backed source.
- Stop rebuilding export content from stale `editorContent` in preview mode.
- Ensure reopen flows restore the same primary document source.

### Phase 3: UI Feature Rebinding

- Ribbon formatting uses adapter capabilities first.
- Find/replace uses adapter find/replace when supported.
- AI pane reads and writes through adapter selection APIs.
- Outline and task panes move to engine snapshots instead of TipTap traversal.

### Phase 4: Feature Parity

- page layout
- header and footer
- image and table insertion
- review and revision flows
- citation and cross-reference insertion

### Phase 5: Legacy Path Reduction

- keep `legacy-tiptap` only as a fallback during transition
- remove direct TipTap feature dependencies once parity is reached

## Acceptance Criteria

- Default engine can save, reopen, and export the same real content the user sees.
- Core Ribbon actions reflect and apply against the active engine reliably.
- AI rewrite uses the active engine selection and applies back into the same document source.
- UI capability states are predictable; unsupported features are not fake-enabled.
- Product-facing UI no longer exposes implementation terms such as "preview surface" as the main authoring language.

## Immediate Build Order

1. Add capability-based engine helpers and stop branching UI by raw engine kind.
2. Unify preview save/export around the file-backed authoring source.
3. Rebind outline, properties, and review panes to adapter snapshots.
4. Move workspace storage under project-local `DATA/`.
5. Remove product-visible engineering/debug wording from the main editor surface.
