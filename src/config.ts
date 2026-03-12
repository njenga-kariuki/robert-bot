import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file (zero-dep, runs before anything else)
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  telegram: {
    botToken: env("TELEGRAM_BOT_TOKEN"),
    groupChatId: Number(env("TELEGRAM_GROUP_CHAT_ID")),
    jayUserId: Number(env("JAY_TELEGRAM_USER_ID")),
    robertUserId: Number(env("ROBERT_TELEGRAM_USER_ID")),
  },
  anthropic: {
    apiKey: env("ANTHROPIC_API_KEY"),
    model: "claude-sonnet-4-6" as const,
  },
  timezone: {
    default: env("DEFAULT_TIMEZONE", "Africa/Nairobi"),
    nairobi: "Africa/Nairobi",
    seattle: "America/Los_Angeles",
  },
  db: {
    path: resolve(__dirname, "..", "data", "robert.db"),
    sandboxPath: resolve(__dirname, "..", "data", "sandbox.db"),
  },
  webhook: {
    url: process.env.WEBHOOK_URL,
    port: Number(process.env.PORT || 3000),
  },
  projectRoot: resolve(__dirname, ".."),
};
