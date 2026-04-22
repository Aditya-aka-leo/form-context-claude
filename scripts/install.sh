#!/bin/bash
# Installs aem-forms-context skills into a project's .claude/commands/ directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Default target: current working directory
TARGET_DIR="${1:-$(pwd)}"
COMMANDS_DIR="$TARGET_DIR/.claude/commands"

echo "Installing aem-forms-context skills to: $COMMANDS_DIR"

mkdir -p "$COMMANDS_DIR"

# Copy all command files
for cmd_file in "$REPO_ROOT/commands/"*.md; do
  cp "$cmd_file" "$COMMANDS_DIR/"
  echo "  ✓ $(basename "$cmd_file")"
done

# Ensure .aem-auth is gitignored in target project
GITIGNORE="$TARGET_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -q ".aem-auth" "$GITIGNORE"; then
    echo ".aem-auth" >> "$GITIGNORE"
    echo "  ✓ added .aem-auth to .gitignore"
  fi
else
  echo ".aem-auth" > "$GITIGNORE"
  echo "  ✓ created .gitignore with .aem-auth"
fi

# Ensure forms/ context folder exists in target project
mkdir -p "$TARGET_DIR/forms"
if [ ! -f "$TARGET_DIR/forms/.gitkeep" ]; then
  touch "$TARGET_DIR/forms/.gitkeep"
fi

echo ""
echo "Done. Use /fetch-form-model <aem-url> in Claude Code to fetch form models."
