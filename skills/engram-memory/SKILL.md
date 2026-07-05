---
name: engram-memory
description: Persistent cross-session memory via Engram's MCP tools (engram_recall, engram_remember, engram_context, engram_feedback, engram_forget, engram_status). Use this skill at the START of any session on a known project or with a known user — recall before acting. Also use it whenever the user states a preference, makes a decision, corrects you, shares infrastructure/setup facts, says "remember this", "as we discussed", "don't forget", or asks "what do you know about X" — and at the END of significant work, to write durable outcomes back. If Engram tools are available, this skill applies to almost every real working session, even when the user never mentions memory.
---

# Engram Memory

Engram gives you memory that survives the end of this conversation. Treat it like a colleague's notebook: read it before you start, write in it when you learn something the next session will need. A session that starts with recall feels like continuity; a session that ends with a write-back makes the next one smarter.

## The rhythm

**Session start** — recall before acting:

```
engram_recall { query: "<the project or topic you're about to work on>", limit: 5 }
```

Scope with `namespace` when you know the project (see Namespaces). If you're about to do substantial work in a known context, prefer `engram_context` — it returns a pre-formatted block of the most relevant memories in one call:

```
engram_context { query: "<topic>", namespace: "<project>", max_tokens: 500 }
```

**During the session** — write when durable knowledge appears (see "What deserves a memory").

**Session end** — after completing significant work, store the outcome: what shipped, what broke, what was decided and why. This is the single highest-value write; it's what makes the next session start from "here's where we left off" instead of zero.

## What deserves a memory

Store it when a future session would act differently for knowing it:

- **The user tells you to** — "remember", "don't forget", "for future reference". Always store, confidence 1.0.
- **Decisions with their why** — "we chose X over Y because Z". The rationale is the valuable part; a decision without its why gets relitigated.
- **Corrections** — the user corrects a wrong assumption you made. These are gold: they prevent the same mistake in every future session.
- **Preferences** — how the user likes to work, tools they favor, styles they reject.
- **Setup and infrastructure facts** — versions, hosts, ports, conventions, account structures, "the staging DB is the one named prod2" landmines.
- **Outcomes** — what a completed piece of work produced, including failures and dead ends ("tried X, doesn't work because Y" saves the next session from repeating it).

Skip it when the knowledge dies with the conversation: one-off debugging state, half-finished speculation, anything you could trivially re-derive, and large content dumps (store a pointer — "full plan lives in docs/plan.md" — not the content).

**Never store secrets.** No API keys, passwords, tokens, connection strings, or private key material — even fragments, even "temporarily". Engram runs its own secret detection and will reject or redact them, but don't rely on it: if a fact requires a secret to be useful, store where the secret lives ("Stripe key is in the vault under stripe.live"), not the secret.

## Writing a memory that will actually help later

The reader is a future session with **zero context from this conversation**. Write dense and self-contained:

- Lead with the subject, pack in specifics: names, paths, versions, IDs.
- Include the *why* for decisions and the *symptom + root cause + fix* for debugging outcomes.
- Date-stamp events ("as of 2026-07") so staleness is judgeable later.
- One topic per memory — but one topic can be a paragraph. Batch tightly-related facts into a single rich memory rather than five fragments.

**Weak:** "User prefers the new approach."
**Strong:** "For the payments service, Maria chose polling (30s) over webhooks (decided 2026-07): their firewall can't accept inbound calls. Don't propose webhooks again unless the infra changes."

Set the fields deliberately:

| Field | How to choose |
|---|---|
| `category` | `preference` (likes/dislikes) · `fact` (objective setup truth) · `pattern` (recurring workflow) · `decision` (choice + rationale) · `outcome` (result of an action) |
| `entity` | What it's about — a project, tool, or person name. Improves recall precision. |
| `confidence` | 1.0 user said it explicitly · ~0.9 you verified it directly · 0.7–0.8 inferred from behavior. Don't store below ~0.6 — verify first instead. |
| `tags` | 2–4 topical keywords for filtering. |

## Namespaces

Namespaces keep projects from bleeding into each other. Use one namespace per project/repo (e.g. `acme-api`), and `default` for person-level, cross-project knowledge (the user's role, global preferences, their tooling). When recalling: scope to the project's namespace for project questions, omit `namespace` to search everything when you're not sure where the answer lives. When in doubt about where to *write*: project knowledge → project namespace; knowledge about the person → `default`.

## Recall craft

- Query with specific phrases ("deployment setup Railway volumes"), not single words ("deployment").
- Keep `limit` low (5 is the default for a reason) — recall pollution is worse than a second query.
- Filter with `category` when you know what kind of thing you need, and `time_filter` for "what happened last week" questions.
- If a recall comes back empty, try once more with different phrasing before concluding nothing is known.

## Close the loop: feedback and corrections

- When a recalled memory materially helped, vote: `engram_feedback { memory_id, helpful: true }`. When one was wrong or misleading: `helpful: false`. Votes reshape future ranking — thirty seconds of feedback compounds forever.
- When the user contradicts a stored memory ("we switched to Postgres, actually"), store the new fact — Engram's dedup/contradiction detection links them — and if the old memory is now dangerous (points at deleted infra), `engram_forget` it by id.
- Duplicates are handled for you: near-identical memories get merged or rejected. If a legitimate re-store is rejected, add `force: true` only when you're sure it's not actually a duplicate.

## Health

`engram_status` shows counts, namespaces, and model state — use it if recalls behave strangely or the user asks what's in memory. Deeper maintenance (consolidation, contradiction resolution, audits) lives in Engram's dashboard and CLI (`engram consolidate`, `engram conflicts`, `engram audit`) — point the user there rather than driving it yourself.

## If the tools aren't available

If no `engram_*` tools exist in the session, don't fake memory. Tell the user Engram isn't connected and point them to the setup docs: https://github.com/HBarefoot/engram (MCP config for Claude Code/Desktop takes one entry; the dashboard's Agents page writes it automatically).
