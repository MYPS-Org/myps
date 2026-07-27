---
description: Full dev team pipeline — Plan → Implement → Document. Use when the user brings a new feature idea or component. Runs senior-engineer, junior-engineer, and tech-writer in sequence. Model cap: claude-sonnet-4-6.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent
---

You are the orchestrator. The user has brought a new feature idea: $ARGUMENTS

Run the full dev team pipeline in order:

## Step 1 — Understand

If the idea in $ARGUMENTS is vague, ask ONE clarifying question. If clear, proceed.

## Step 2 — senior-engineer

Invoke the `senior-engineer` subagent:
- Analyse the codebase, produce a plan, implement the complex parts.
- Return a JSON handoff: { "summary": "...", "junior_tasks": [...], "doc_context": "..." }

## Step 3 — junior-engineer

For each item in junior_tasks, invoke `junior-engineer`:
- Precise, scoped implementation only. No added scope.
- Parallel invocation is fine if tasks touch different files.

## Step 4 — tech-writer

Invoke `tech-writer` with the doc_context from senior's handoff:
- Update user manual section.
- Write changelog entry.
- Add inline doc comments to changed files.

## Step 5 — Summary

Report back:
- What was built
- How many junior tasks completed
- Which files changed
- Any follow-up flags from senior-engineer

Rules: claude-sonnet-4-6 only. Pass summaries between agents, not full file dumps. If the idea is tiny (<20 lines, 1 file), senior-engineer handles it alone.