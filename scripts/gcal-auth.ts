/**
 * Google Calendar OAuth2 setup script.
 * Adapted from ai-daily-digest/scripts/gmail-auth.ts
 *
 * Prerequisites:
 * 1. Create a Google Cloud project (or reuse existing)
 * 2. Enable Google Calendar API
 * 3. Create OAuth 2.0 credentials (Desktop app)
 * 4. Download as credentials.json into robert-bot/
 *
 * Usage: npm run gcal-auth
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline";
import { createServer } from "http";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const CRED_PATH = resolve(import.meta.dirname ?? ".", "..", "credentials.json");
const TOKEN_PATH = resolve(import.meta.dirname ?? ".", "..", "token.json");

async function main() {
  if (!existsSync(CRED_PATH)) {
    console.error(
      "Missing credentials.json. Download it from Google Cloud Console:"
    );
    console.error(
      "  1. Go to console.cloud.google.com → APIs & Services → Credentials"
    );
    console.error("  2. Create OAuth 2.0 Client ID (Desktop app)");
    console.error(`  3. Download JSON and save as: ${CRED_PATH}`);
    process.exit(1);
  }

  const creds = JSON.parse(readFileSync(CRED_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } =
    creds.installed || creds.web;

  const oauth2 = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3456"
  );

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\nOpen this URL in your browser:\n");
  console.log(authUrl);
  console.log("\nWaiting for OAuth callback on http://localhost:3456 ...\n");

  // Start a local server to catch the OAuth redirect
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:3456`);
      const code = url.searchParams.get("code");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h2>Authorization successful!</h2><p>You can close this tab.</p>"
        );
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end("Missing code parameter");
      }
    });

    server.listen(3456);
    server.on("error", reject);
  });

  const { tokens } = await oauth2.getToken(code);
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`Token saved to ${TOKEN_PATH}`);
  console.log("Google Calendar is now connected!");
}

main().catch(console.error);
