import { config } from "../config.js";

/**
 * Get current date/time in a specific timezone.
 */
export function nowInTimezone(tz: string = config.timezone.default): Date {
  const now = new Date();
  const str = now.toLocaleString("en-US", { timeZone: tz });
  return new Date(str);
}

/**
 * Format a date for display in Telegram messages.
 */
export function formatDate(
  dateStr: string,
  options?: { includeTime?: boolean }
): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const fmt: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: config.timezone.default,
  };

  if (options?.includeTime) {
    fmt.hour = "numeric";
    fmt.minute = "2-digit";
    fmt.hour12 = true;
  }

  return date.toLocaleDateString("en-US", fmt);
}

/**
 * Format a date as ISO date string (YYYY-MM-DD) in the default timezone.
 */
export function toISODate(date: Date): string {
  return date
    .toLocaleDateString("en-CA", { timeZone: config.timezone.default })
    .split("/")
    .join("-");
}

/**
 * Get start and end dates for common period names.
 */
export function parsePeriod(period: string): {
  start: string;
  end: string;
  label: string;
} {
  const now = nowInTimezone();
  const today = toISODate(now);

  const lower = period.toLowerCase().trim();

  if (lower === "today") {
    return { start: today, end: today, label: "Today" };
  }

  if (lower === "this week" || lower === "week") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return {
      start: toISODate(startOfWeek),
      end: today,
      label: "This week",
    };
  }

  if (lower === "this month" || lower === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: toISODate(startOfMonth),
      end: today,
      label: "This month",
    };
  }

  if (lower === "last week") {
    const endOfLastWeek = new Date(now);
    endOfLastWeek.setDate(now.getDate() - now.getDay() - 1);
    const startOfLastWeek = new Date(endOfLastWeek);
    startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
    return {
      start: toISODate(startOfLastWeek),
      end: toISODate(endOfLastWeek),
      label: "Last week",
    };
  }

  if (lower === "last month") {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      start: toISODate(startOfLastMonth),
      end: toISODate(endOfLastMonth),
      label: "Last month",
    };
  }

  // Try month name (e.g., "March", "February")
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const monthIdx = months.indexOf(lower);
  if (monthIdx !== -1) {
    const year = monthIdx <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1;
    const start = new Date(year, monthIdx, 1);
    const end = new Date(year, monthIdx + 1, 0);
    return {
      start: toISODate(start),
      end: toISODate(end),
      label: `${months[monthIdx].charAt(0).toUpperCase() + months[monthIdx].slice(1)} ${year}`,
    };
  }

  // Default: this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: toISODate(startOfMonth),
    end: today,
    label: "This month",
  };
}
