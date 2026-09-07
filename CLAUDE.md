# Robert Bot

Telegram bot for coordinating tasks, expenses, and logistics with an associate in Nairobi.

## Stack
- **Runtime:** Node.js + TypeScript (ESM)
- **Telegram:** grammY framework
- **Database:** sql.js (SQLite via Wasm — no native deps). Separate prod + sandbox DBs.
- **AI:** Claude Sonnet (`claude-sonnet-4-6`) for intent classification, parameter extraction, vision, DM research
- **Calendar:** Google Calendar API (OAuth2)
- **Deployment:** Railway (long-polling dev, webhook prod)

## Commands
```
npm run dev        # Local dev with hot reload (long-polling)
npm run build      # TypeScript compile
npm run start      # Production (webhook if WEBHOOK_URL set)
npm run migrate    # Create/update DB schema
npm run gcal-auth  # Google Calendar OAuth setup
```

## Architecture

### Channel model
- **Group chat** = shared workspace (tasks, expenses, shopping, reminders — visible to both)
- **DM with bot** = personal space (notes, research questions, private use of same commands)
- In DMs, unmatched messages go to Claude as a research assistant
- In group, unmatched messages below 0.7 confidence threshold are ignored (no bot interruptions)

### Code patterns
- Command registry: each command is a self-contained module in `src/commands/`
- Adding a command = one file + one import in `src/commands/index.ts`
- NL classifier auto-discovers commands from registry descriptions
- Auth middleware allowlists by chat ID (silent drop for unknown)
- User context middleware: identifies sender, detects DM vs group, routes sandbox DB

### Sandbox mode
- `/sandbox on` switches to a separate SQLite database (`data/sandbox.db`)
- All commands work identically but read/write sandbox data
- `/sandbox wipe` resets. `/sandbox off` returns to live.
- DB routing is handled by middleware setting `activeDb` before each request

## Key Decisions
- Claude Sonnet for ALL AI calls (quality over cost)
- Photos auto-trigger expense flow (no command needed)
- Receipt parser prompts "What was this?" when items can't be extracted
- NL confidence threshold: 0.7 in group (below = ignore). In DM, fallback to research assistant.
- Bilingual: English + Sheng + Swahili-English mix
- Dates: EAT (Africa/Nairobi) for Robert, PST for Njenga
