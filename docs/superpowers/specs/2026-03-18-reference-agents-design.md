# Design: Reference Agents (SolidJS, FiveM, CommunityOx)

**Date:** 2026-03-18
**Status:** Approved

## Purpose

Three autonomous reference/consultation agents that verify APIs, patterns, and best practices before Claude writes code. They act as expert consultants — invoked on demand when working with their respective stacks.

## Architecture

```
~/.claude/agents/
  solidjs-reference.md
  fivem-reference.md
  communityox-reference.md
```

Each agent is a standalone `.md` file with frontmatter + system prompt. No bundled reference directories — all documentation is fetched in real-time via web search and Context7 MCP.

## Agent Specifications

### solidjs-reference

- **Trigger:** Working with `.tsx`/`.ts` in FiveM NUI projects, SolidJS reactivity, signals, stores, effects
- **Scope:** SolidJS APIs, reactivity patterns, Vite + vite-plugin-solid, NUI integration (fetchNui, event bridges)
- **Cheatsheet:** Common SolidJS pitfalls (vs React), destructuring props, signal tracking scope, control flow components
- **Model:** sonnet

### fivem-reference

- **Trigger:** Working with `.lua` in FiveM resources, natives, state bags, NUI callbacks, audio nativo, pma-voice, LiveKit, server.cfg
- **Scope:** Full ecosystem — client/server scripting, NUI bridge, fxmanifest, streaming assets (AWC/dat54), pma-voice, LiveKit, server.cfg, deploy
- **Cheatsheet:** Native classification (client/server/shared), fxmanifest patterns, audio nativo patterns, security guardrails
- **Model:** sonnet

### communityox-reference

- **Trigger:** Working with ox_lib, oxmysql, ox_inventory
- **Scope:** ox_lib (cache, callbacks, UI, utilities, zones), oxmysql (query patterns, prepare, transactions), ox_inventory (exports, hooks, item metadata)
- **Authoritative source:** CommunityOX fork documentation (NOT Overextended original if they differ)
- **Cheatsheet:** Most-used exports with signatures, cache fields, query patterns, inventory exports client vs server
- **Model:** sonnet

## Shared Behavior

### Verification Flow

1. Receive query from parent agent
2. Search via web search / Context7 MCP
3. Return structured response with source attribution
4. Never invent APIs — if not found, say so explicitly

### Response Format

```
## Verification: <what was verified>
- **Source:** <URL or "Context7 MCP">
- **Result:** <verified information>
- **Classification:** CLIENT-ONLY | SERVER-ONLY | SHARED (FiveM only)
- **Example:** <minimal correct usage snippet>
```

### When NOT to invoke

If the parent agent has 100% certainty about an API (existing repo code already uses it correctly).

### Available Tools

WebSearch, WebFetch, Grep, Glob, Read

## Decisions

- **Agents over skills:** Agents run as subprocesses, keeping the main context clean. Trade-off: no slash command invocation, but the consultation pattern doesn't need it.
- **No bundled references:** Real-time search ensures up-to-date info. Trade-off: requires internet, slightly slower than local files.
- **Sonnet model:** Fast enough for reference lookups, cheaper than opus. The parent agent (opus) makes the architectural decisions.
- **Embedded cheatsheets:** Each agent includes a quick-reference section in its system prompt for the most critical patterns that don't need web verification (common pitfalls, security rules).
