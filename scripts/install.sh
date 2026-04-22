#!/bin/bash
# Installs form-context-claude into a project.
# Everything goes into .form-context/ (gitignored).
# Only the slash command goes into .claude/commands/ (required by Claude Code).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

TARGET_DIR="${1:-$(pwd)}"
FC_DIR="$TARGET_DIR/.form-context"

echo "Installing form-context-claude into: $TARGET_DIR"
echo ""

# 1. Create .form-context/ structure
mkdir -p "$FC_DIR/forms"
mkdir -p "$FC_DIR/scripts"

# 2. Copy distill.js into .form-context/scripts/
cp "$REPO_ROOT/scripts/distill.js" "$FC_DIR/scripts/distill.js"
echo "  ✓ .form-context/scripts/distill.js"

# 3. Copy CLAUDE.md into .form-context/
cp "$REPO_ROOT/CLAUDE.md" "$FC_DIR/CLAUDE.md"
echo "  ✓ .form-context/CLAUDE.md"

# 4. Copy slash command into .claude/commands/ (Claude Code requires this location)
mkdir -p "$TARGET_DIR/.claude/commands"
cp "$REPO_ROOT/commands/fetch-form-model.md" "$TARGET_DIR/.claude/commands/"
echo "  ✓ .claude/commands/fetch-form-model.md"

# 5. Gitignore .form-context/ entirely
GITIGNORE="$TARGET_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -q "\.form-context/" "$GITIGNORE"; then
    echo ".form-context/" >> "$GITIGNORE"
    echo "  ✓ added .form-context/ to .gitignore"
  else
    echo "  ~ .form-context/ already in .gitignore"
  fi
else
  echo ".form-context/" > "$GITIGNORE"
  echo "  ✓ created .gitignore with .form-context/"
fi

echo ""
echo "Done. Everything lives in .form-context/ (gitignored)."
echo ""
echo "Next steps:"
echo "  1. Get your AEM cookie: DevTools → Network → any AEM request → copy Cookie header value"
echo "  2. Save it:  echo '<paste-cookie>' > $FC_DIR/.aem-auth"
echo "  3. In Claude Code: /fetch-form-model <aem-form-url>"
