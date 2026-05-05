---
name: generate-user-manual
description: 'Generate a user manual in Markdown format for the MYPS application. Use when: creating documentation, writing a user guide, documenting features or modules, updating the user manual. Asks whether the manual should cover the entire application (global) or a specific folder/module only.'
argument-hint: 'Optional: specify a module or folder name to document'
---

# Generate User Manual

## Purpose
Generate a well-structured, end-user-friendly Markdown user manual for the MYPS application. The manual explains what each feature does, how to navigate it, and step-by-step instructions — written for non-technical users.

## When to Use
- Creating or refreshing the project's `UserManual.md`
- Documenting a new module added to the frontend
- Writing module-level documentation for a specific folder or feature set

---

## Procedure

### Step 1 — Ask Scope

Use the `vscode_askQuestions` tool to ask:

```
question: "Should this manual cover the entire application or a specific module/folder?"
options:
  - label: "Global — entire application"
  - label: "Specific module or folder"
```

If the user selects **Specific module or folder**, ask a follow-up free-text question:

```
question: "Which module or folder should the manual cover? (e.g. Programs, Projects, FE/src/pages/Programs)"
```

---

### Step 2 — Explore the Codebase

**For Global scope:**
- Read [`FE/src/pages/`](../../../FE/src/pages/) to enumerate all top-level modules/pages
- Read [`FE/src/components/`](../../../FE/src/components/) for shared UI components
- Read [`WebAPI/Controllers/`](../../../WebAPI/Controllers/) to understand available API surfaces
- Read the existing [`FE/UserManual.md`](../../../FE/UserManual.md) for any existing content to merge or update

**For Specific scope:**
- Read the named folder (e.g. `FE/src/pages/<Module>/`)
- Read any related controller files in `WebAPI/Controllers/`
- Read related type definitions in `FE/src/types/`

Use `list_dir` and `read_file` to gather enough context. Do **not** read every file — focus on:
- Page-level components (`.tsx` files in `pages/`)
- API calls (`services/` or `hooks/`)
- Navigation structure (router config if present)

---

### Step 3 — Generate the Manual

Use the [manual template](./assets/manual-template.md) as a structural guide.

**Global manual** → Output as `FE/UserManual.md`  
**Module manual** → Output as `FE/src/pages/<Module>/UserManual.md` (or the folder the user specified)

#### Manual Content Rules
- Write for **non-technical end users** — no code, no jargon
- Every section must have a **purpose sentence** explaining what the feature does
- Use **Step-by-Step** numbered lists for any action a user performs
- Use **tables** to describe fields, dropdowns, or options
- Use **ASCII diagrams** or describe layout for key screens (see existing manual for style reference)
- Add a **Table of Contents** with anchor links
- Set `Last Updated` to today's date and increment the version number if updating an existing manual

#### Required Sections (Global)
1. Introduction — system purpose and module overview table
2. One section per top-level module/page
3. Each module section must cover: Purpose, How to Navigate, Key Actions (step-by-step), Field Descriptions (table)

#### Required Sections (Module-specific)
1. Module Overview (purpose + access requirements)
2. Screen Layout description
3. Key Actions (step-by-step per major workflow)
4. Field/Column Reference (table)
5. Common Issues / Tips (if applicable)

---

### Step 4 — Write the File

- If the output file already exists, read it first and **merge** new/changed sections rather than overwriting unchanged content
- Preserve any existing sections the user has manually written unless the codebase clearly contradicts them
- Use `replace_string_in_file` for targeted updates or `create_file` for new files

---

### Step 5 — Confirm

Report to the user:
- The file path written
- The sections included
- Any modules that were skipped due to insufficient code context (with a note to re-run with a specific scope)
