# May I?

A contract rummy card game for family game nights, playable via CLI or web.

## Why?

Built to digitize grandma's card game so the family can play together remotely. Also an experiment in AI game-playing agents and a learning playground for XState, Vercel AI SDK, and modern TypeScript tooling.

## Features

- **Complete game engine** — ~2000 tests covering all game rules and edge cases
- **Terminal game** — Interactive mode with numbered menus and visual feedback
- **AI opponents** — Spark Contributor by default, with optional Claude, GPT, Gemini, or Grok
- **Agent harness** — CLI designed for AI agents to play via commands
- **Web app** — Real-time multiplayer via WebSockets (in design)

## Quick Start

```bash
bun install
bun cli/play.ts --interactive  # Play against AI opponents
bun test                       # Run test suite
```

## What is May I?

May I? is a contract rummy variant for 3-8 players, played over 6 rounds. Each round has a contract you must meet to "lay down" (e.g., "2 sets", "1 set + 1 run"). The signature mechanic: when someone draws from the stock pile, other players can call "May I?" to claim the top discard — but they take a penalty card too.

Lowest total score after 6 rounds wins.

See [House Rules](docs/house-rules.md) for complete rules.

AI players share one notebook-plus-examples configuration, separate from the
house rules. Spark uses low reasoning effort; other model choices change only
provider settings, not player behavior. See the [configuration and evaluation
record](docs/ai-player-notebook-experiment.md).

## Form Factors

| Mode | Description | Status |
|------|-------------|--------|
| Interactive CLI | Terminal game with menus, AI opponents | Complete |
| Agent Harness | Command-line interface for AI agents | Complete |
| Web App | Real-time multiplayer via WebSockets | In Progress |

- [Interactive Mode Guide](docs/interactive-mode.md) — How to play in the terminal
- [Agent Harness Guide](docs/agent-game-harness.md) — CLI commands for AI agents

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Web Framework | [React Router 7](https://reactrouter.com) + Vite |
| Deployment | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| Realtime | [PartyKit](https://partykit.io) (WebSockets) |
| State Machine | [XState v5](https://stately.ai/docs) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai) (Anthropic, OpenAI, Google, xAI, OpenRouter) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| Validation | [Zod](https://zod.dev) |

## Project Structure

```
app/      Web app (React Router + Cloudflare Workers)
core/     Game engine (cards, melds, XState machines)
cli/      CLI harness and interactive mode
ai/       LLM-powered AI players
docs/     Documentation
specs/    Design specs and plans
```

## Documentation

| Doc | Description |
|-----|-------------|
| [House Rules](docs/house-rules.md) | Complete game rules (Petersen family edition) |
| [Glossary](docs/glossary.md) | Terminology and data model |
| [XState Engine](docs/xstate-engine.md) | State machine architecture deep dive |
| [Interactive Mode](docs/interactive-mode.md) | Human-friendly terminal game |
| [Agent Harness](docs/agent-game-harness.md) | CLI commands for AI agents |
| [AI Player Evaluation](docs/ai-player-evaluation.md) | Tactical skill, reliability, latency, and cost benchmark |

## Development

```bash
bun install           # Install dependencies
bun test              # Run tests (~2000, fast)
bun run typecheck     # Type check
```

### Integration Tests

AI integration tests (real LLM API calls) are skipped by default for speed. To run them:

```bash
RUN_INTEGRATION_TESTS=1 bun test ai/
```

The Meta Muse Spark contributor model uses `OPENROUTER_API_KEY`. OpenRouter's
account privacy settings must allow paid endpoints that train on request data;
prompts and completions sent to this model may be used to improve Meta's products.
