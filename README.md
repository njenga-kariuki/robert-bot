# Robert Bot

A Telegram operations assistant for coordinating tasks, expenses, shopping and reminders between a principal and an associate. Built by Njenga Kariuki in 2026 around a shared chat workflow, with private direct messages for notes and research.

## What is implemented

- A command registry covering tasks, receipt and M-Pesa expense capture, shopping lists, reminders, standing routines and spending summaries.
- Natural-language intent classification and parameter extraction with Claude, including English, Swahili and Sheng phrasing.
- Receipt-image parsing and Google Calendar integration.
- SQLite persistence through sql.js, with separate live and sandbox databases.
- Chat allowlisting, role-based controls, practice guidance and a deliberate switch from sandbox to live tracking.
- A confidence threshold that keeps low-confidence group messages from interrupting ordinary conversation; direct messages can fall back to a research assistant.

## Run your own instance

Use Node.js and npm. Run `npm ci`, copy `.env.example` to `.env`, and populate your own Telegram bot token, permitted chat/user IDs and Anthropic API key. `bash scripts/setup.sh` provides an interactive alternative.

Run `npm run migrate` to create the local databases, then `npm run dev` for long polling. `npm run build` compiles the TypeScript source. For Google Calendar, add your own OAuth client as `credentials.json` and run `npm run gcal-auth`.

Review the participant names, roles and timezones in the configuration and prompts when adapting it. The original environment-variable names are retained for compatibility. Runtime databases, messages, receipts and OAuth credentials are ignored by Git and are not part of this source release.

## Design notes

`src/commands/` holds the command modules; `src/middleware/` handles authorization, user context and natural-language routing. `src/services/` contains AI, calendar, scheduling and receipt integrations. The sandbox is intended for practicing the workflow before recording live activity.

This is the source of a personal coordination tool developed in March 2026. External APIs and model availability need to be configured for a new installation; this release does not include the original service accounts or stored operational data.
