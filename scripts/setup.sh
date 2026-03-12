#!/usr/bin/env bash
set -euo pipefail

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BOT_DIR/.env"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Robert Bot — Setup Wizard          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ -f "$ENV_FILE" ]; then
  echo "Found existing .env file at $ENV_FILE"
  read -p "Start over? (y/N): " overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Keeping existing .env. Next steps:"
    echo "  cd $BOT_DIR && npm run migrate && npm run dev"
    exit 0
  fi
fi

echo "═══ STEP 1: Create the Telegram Bot ═══"
echo ""
echo "  1. Open Telegram and search for @BotFather"
echo "  2. Send: /newbot"
echo "  3. Name it: Robert Bot"
echo "  4. Username: something like robert_mgmt_bot"
echo "  5. BotFather will give you a token like:"
echo "     7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
echo ""
read -p "  Paste your bot token here: " BOT_TOKEN

# Validate token format
if [[ ! "$BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
  echo "  ⚠️  That doesn't look like a valid token. Expected format: 1234567890:ABCdefGHIjklmNOP"
  read -p "  Continue anyway? (y/N): " cont
  [[ ! "$cont" =~ ^[Yy]$ ]] && exit 1
fi

echo ""
echo "═══ STEP 2: Get Your Telegram User ID ═══"
echo ""
echo "  1. Open Telegram and search for @userinfobot"
echo "  2. Send it any message"
echo "  3. It will reply with your User ID (a number)"
echo ""
read -p "  Jay's Telegram User ID: " JAY_USER_ID
read -p "  Robert's Telegram User ID: " ROBERT_USER_ID

echo ""
echo "═══ STEP 3: Create a Group Chat ═══"
echo ""
echo "  1. Create a new Telegram group with you and Robert"
echo "  2. Add the bot (@your_bot_username) to the group"
echo "  3. Send any message in the group"
echo "  4. Now we'll find the group's Chat ID..."
echo ""
echo "  Getting chat ID from Telegram API..."

# Try to auto-detect the group chat ID
CHAT_ID=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates" | \
  grep -o '"chat":{"id":-[0-9]*' | head -1 | grep -o '\-[0-9]*' || echo "")

if [ -n "$CHAT_ID" ]; then
  echo "  ✅ Found group chat ID: $CHAT_ID"
  read -p "  Use this? (Y/n): " use_detected
  if [[ "$use_detected" =~ ^[Nn]$ ]]; then
    read -p "  Enter group chat ID manually: " CHAT_ID
  fi
else
  echo "  Couldn't auto-detect. Make sure you:"
  echo "    - Added the bot to the group"
  echo "    - Sent a message AFTER adding the bot"
  echo "  Then try again, or enter the ID manually."
  echo ""
  echo "  To find it manually:"
  echo "    Open: https://api.telegram.org/bot${BOT_TOKEN}/getUpdates"
  echo "    Look for: \"chat\":{\"id\":-XXXXXXXXXX"
  echo ""
  read -p "  Group Chat ID (starts with -): " CHAT_ID
fi

echo ""
echo "═══ STEP 4: Anthropic API Key ═══"
echo ""
echo "  Your existing key from other projects should work."
echo "  Find it at: https://console.anthropic.com/settings/keys"
echo ""
read -p "  Anthropic API Key: " ANTHROPIC_KEY

# Write .env
cat > "$ENV_FILE" << EOF
# Telegram
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_GROUP_CHAT_ID=$CHAT_ID
JAY_TELEGRAM_USER_ID=$JAY_USER_ID
ROBERT_TELEGRAM_USER_ID=$ROBERT_USER_ID

# Anthropic
ANTHROPIC_API_KEY=$ANTHROPIC_KEY

# Timezone
DEFAULT_TIMEZONE=Africa/Nairobi
EOF

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            ✅ Setup Complete              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  .env written to: $ENV_FILE"
echo ""
echo "  Next steps:"
echo "    cd $BOT_DIR"
echo "    npm run migrate     # Set up the database"
echo "    npm run dev          # Start the bot"
echo ""
echo "  Once running:"
echo "    1. DM the bot and type /test to verify everything works"
echo "    2. Type /sandbox on in the group to practice"
echo "    3. When ready, /sandbox off to go live"
echo ""
echo "  Google Calendar (optional, can do later):"
echo "    1. Place credentials.json in $BOT_DIR"
echo "    2. npm run gcal-auth"
