import { google, type calendar_v3 } from "googleapis";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "../config.js";

let calendarClient: calendar_v3.Calendar | null = null;

/**
 * Initialize the Google Calendar client using stored OAuth tokens.
 * Returns null if credentials aren't configured yet (non-fatal).
 */
function getCalendarClient(): calendar_v3.Calendar | null {
  if (calendarClient) return calendarClient;

  const credPath = resolve(config.projectRoot, "credentials.json");
  const tokenPath = resolve(config.projectRoot, "token.json");

  if (!existsSync(credPath) || !existsSync(tokenPath)) {
    console.log(
      "Google Calendar not configured (missing credentials.json or token.json). Run: npm run gcal-auth"
    );
    return null;
  }

  try {
    const creds = JSON.parse(readFileSync(credPath, "utf-8"));
    const token = JSON.parse(readFileSync(tokenPath, "utf-8"));

    const { client_id, client_secret, redirect_uris } =
      creds.installed || creds.web;

    const oauth2 = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0]
    );
    oauth2.setCredentials(token);

    // Auto-refresh tokens
    oauth2.on("tokens", (newTokens) => {
      const merged = { ...token, ...newTokens };
      writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
    });

    calendarClient = google.calendar({ version: "v3", auth: oauth2 });
    return calendarClient;
  } catch (err) {
    console.error("Failed to init Google Calendar:", err);
    return null;
  }
}

/**
 * Create a calendar event for a reminder.
 * Returns the event ID or null if calendar isn't configured.
 */
export async function createCalendarEvent(opts: {
  summary: string;
  description?: string;
  startTime: string; // ISO datetime
  endTime?: string; // ISO datetime (defaults to start + 30min)
}): Promise<string | null> {
  const cal = getCalendarClient();
  if (!cal) return null;

  const start = new Date(opts.startTime);
  const end = opts.endTime
    ? new Date(opts.endTime)
    : new Date(start.getTime() + 30 * 60 * 1000);

  try {
    const event = await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `[Robert Bot] ${opts.summary}`,
        description: opts.description,
        start: {
          dateTime: start.toISOString(),
          timeZone: config.timezone.default,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: config.timezone.default,
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 10 }],
        },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error("Failed to create calendar event:", err);
    return null;
  }
}

/**
 * Delete a calendar event by ID.
 */
export async function deleteCalendarEvent(
  eventId: string
): Promise<boolean> {
  const cal = getCalendarClient();
  if (!cal) return false;

  try {
    await cal.events.delete({
      calendarId: "primary",
      eventId,
    });
    return true;
  } catch (err) {
    console.error("Failed to delete calendar event:", err);
    return false;
  }
}
