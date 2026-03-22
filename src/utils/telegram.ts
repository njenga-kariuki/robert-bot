import type { Bot, Context } from "grammy";

/**
 * Escape HTML special characters for Telegram's HTML parse mode.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bold text in HTML mode.
 */
export function bold(text: string): string {
  return `<b>${escapeHtml(text)}</b>`;
}

/**
 * Italic text in HTML mode.
 */
export function italic(text: string): string {
  return `<i>${escapeHtml(text)}</i>`;
}

/**
 * Code (monospace) text in HTML mode.
 */
export function code(text: string): string {
  return `<code>${escapeHtml(text)}</code>`;
}

/**
 * Format a currency amount (KES).
 */
export function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

/** Valid Telegram HTML tags — used to protect existing tags from escaping */
const TELEGRAM_TAG_RE = /(<\/?(?:b|i|u|s|code|pre|blockquote|a(?:\s[^>]*)?)>)/g;

/**
 * Escape stray `<` and `>` that are NOT part of valid Telegram HTML tags.
 * Splits on valid tags, escapes everything else, then reassembles.
 */
function escapeStrayAngleBrackets(text: string): string {
  const parts = text.split(TELEGRAM_TAG_RE);
  return parts
    .map((part) => {
      // If this part matches a valid Telegram tag, leave it alone
      if (TELEGRAM_TAG_RE.test(part)) {
        TELEGRAM_TAG_RE.lastIndex = 0; // reset regex state
        return part;
      }
      // Escape any < > that aren't part of valid tags
      return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    })
    .join("");
}

/**
 * Check whether text already contains Telegram HTML tags,
 * meaning Claude followed the formatting instructions.
 */
function containsTelegramHtml(text: string): boolean {
  return /<(?:b|i|u|s|code|pre|blockquote|a\s)[\s>]/i.test(text);
}

/**
 * Convert Markdown formatting from Claude responses to Telegram HTML.
 * Idempotent-safe: if text already contains Telegram HTML tags (Claude followed
 * formatting instructions), skips markdown conversion and only escapes stray
 * angle brackets. If text is markdown, converts to clean Telegram HTML.
 */
export function markdownToTelegramHtml(text: string): string {
  const hasMarkdown = /(?:^#{1,6}\s|\*\*|__|\*[^*]|^[-*]\s|^\|.+\|$|```)/m.test(text);
  const hasHtml = containsTelegramHtml(text);

  // If Claude already output Telegram HTML and there's no markdown mixed in,
  // just escape stray angle brackets and clean up
  if (hasHtml && !hasMarkdown) {
    let result = text;
    result = escapeStrayAngleBrackets(result);
    result = result.replace(/\n{3,}/g, "\n\n");
    return result.trim();
  }

  // Otherwise, convert markdown → Telegram HTML
  let result = text;

  // Protect existing <pre> blocks from conversion
  const preBlocks: string[] = [];
  result = result.replace(/<pre>([\s\S]*?)<\/pre>/g, (match) => {
    const idx = preBlocks.length;
    preBlocks.push(match);
    return `\x00PREBLOCK_${idx}\x00`;
  });

  // Code blocks (``` ... ```) → <pre> (do this first to protect contents)
  const codeBlocks: string[] = [];
  result = result.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre>${escapeHtml(code.trim())}</pre>`);
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // Inline code (`...`) → <code>
  result = result.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);

  // Headers (##+ or bold lines) → bold with line break
  result = result.replace(/^#{1,6}\s+(.+)$/gm, (_, heading) => `<b>${heading.trim()}</b>`);

  // Bold: **text** or __text__ (skip if already inside <b> tags)
  result = result.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  result = result.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ (but not inside words)
  result = result.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, "<i>$1</i>");
  result = result.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, "<i>$1</i>");

  // Markdown bullet lists: - item or * item → • item
  result = result.replace(/^[\s]*[-*]\s+/gm, "• ");

  // Markdown tables → <pre> monospace blocks with aligned columns
  result = result.replace(
    /((?:^\|.+\|$\n?)+)/gm,
    (tableBlock) => {
      const lines = tableBlock.trim().split("\n");
      // Filter out separator rows (|---|---|)
      const dataLines = lines.filter((l) => !l.match(/^\|[\s-:|]+\|$/));
      if (dataLines.length === 0) return "";

      // Parse all rows (header + data)
      const allRows = dataLines.map((line) =>
        line.split("|").map((c) => c.trim()).filter(Boolean)
      );

      if (allRows.length === 0) return "";

      // Calculate column widths
      const colCount = Math.max(...allRows.map((r) => r.length));
      const colWidths: number[] = [];
      for (let col = 0; col < colCount; col++) {
        colWidths.push(Math.max(...allRows.map((r) => (r[col] || "").length)));
      }

      // Build aligned rows
      const formattedLines = allRows.map((cells, rowIdx) => {
        const padded = cells.map((cell, i) => cell.padEnd(colWidths[i] || 0));
        return padded.join("  ");
      });

      // Insert separator after header
      if (allRows.length > 1) {
        const sep = colWidths.map((w) => "─".repeat(w)).join("──");
        formattedLines.splice(1, 0, sep);
      }

      return `<pre>${escapeHtml(formattedLines.join("\n"))}</pre>`;
    }
  );

  // Restore protected blocks
  result = result.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_, idx) => codeBlocks[Number(idx)]);
  result = result.replace(/\x00PREBLOCK_(\d+)\x00/g, (_, idx) => preBlocks[Number(idx)]);

  // Escape stray angle brackets that aren't part of valid Telegram tags
  // (must come after all tag generation)
  result = escapeStrayAngleBrackets(result);

  // Clean up excessive blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Send a silent notification to the group chat when shared state
 * is mutated from a DM. Uses disable_notification so it doesn't buzz.
 */
export async function notifyGroup(
  bot: Bot<Context>,
  senderName: string,
  message: string
): Promise<void> {
  const { config } = await import("../config.js");
  await bot.api.sendMessage(
    config.telegram.groupChatId,
    `[${senderName} via DM] ${message}`,
    { parse_mode: "HTML", disable_notification: true }
  );
}

/**
 * Split a long message into chunks that fit Telegram's 4096 char limit.
 */
export function splitMessage(text: string, maxLen = 4096): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx === -1 || splitIdx < maxLen / 2) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }

  return chunks;
}
