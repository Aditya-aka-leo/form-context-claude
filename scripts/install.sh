#!/bin/bash
# Installs aem-forms-context skills into a project's .claude/commands/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

TARGET_DIR="${1:-$(pwd)}"
COMMANDS_DIR="$TARGET_DIR/.claude/commands"

echo "Installing aem-forms-context into: $TARGET_DIR"
echo ""

# 1. Copy slash commands
mkdir -p "$COMMANDS_DIR"
for cmd_file in "$REPO_ROOT/commands/"*.md; do
  cp "$cmd_file" "$COMMANDS_DIR/"
  echo "  ✓ commands/$(basename "$cmd_file")"
done

# 2. Merge CLAUDE.md — append if exists, create if not
TARGET_CLAUDE="$TARGET_DIR/CLAUDE.md"
SOURCE_CLAUDE="$REPO_ROOT/CLAUDE.md"
MARKER="# AEM Forms Context"

if [ -f "$TARGET_CLAUDE" ]; then
  if grep -q "$MARKER" "$TARGET_CLAUDE"; then
    echo "  ~ CLAUDE.md already contains AEM Forms Context section, skipping"
  else
    echo "" >> "$TARGET_CLAUDE"
    echo "---" >> "$TARGET_CLAUDE"
    echo "" >> "$TARGET_CLAUDE"
    cat "$SOURCE_CLAUDE" >> "$TARGET_CLAUDE"
    echo "  ✓ merged AEM Forms Context into CLAUDE.md"
  fi
else
  cp "$SOURCE_CLAUDE" "$TARGET_CLAUDE"
  echo "  ✓ created CLAUDE.md"
fi

# 3. Ensure .aem-auth is gitignored
GITIGNORE="$TARGET_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -q "\.aem-auth" "$GITIGNORE"; then
    echo ".aem-auth" >> "$GITIGNORE"
    echo "  ✓ added .aem-auth to .gitignore"
  else
    echo "  ~ .aem-auth already in .gitignore"
  fi
else
  echo ".aem-auth" > "$GITIGNORE"
  echo "  ✓ created .gitignore"
fi

# 4. Create forms/ folder
mkdir -p "$TARGET_DIR/forms"
if [ ! -f "$TARGET_DIR/forms/.gitkeep" ]; then
  touch "$TARGET_DIR/forms/.gitkeep"
fi
echo "  ✓ forms/ directory ready"

echo ""
echo "Done. Next steps:"
echo "  1. Run /fetch-form-model <aem-url> in Claude Code to load a form"
echo "  2. Claude will automatically fetch fragment context during discussions"
