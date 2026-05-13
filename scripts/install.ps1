# Installs form-context-claude into a project.
# Everything goes into .form-context/ (gitignored).
# Only the slash command goes into .claude/commands/ (required by Claude Code).
#
# Usage: .\scripts\install.ps1 [target-directory]

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot   = Split-Path -Parent $ScriptDir
$TargetDir  = if ($args[0]) { $args[0] } else { (Get-Location).Path }
$FcDir      = Join-Path $TargetDir ".form-context"

Write-Host "Installing form-context-claude into: $TargetDir"
Write-Host ""

# 1. Create .form-context/ structure
New-Item -ItemType Directory -Force -Path "$FcDir\forms"   | Out-Null
New-Item -ItemType Directory -Force -Path "$FcDir\scripts" | Out-Null

# 2. Copy distill.cjs into .form-context/scripts/
Copy-Item "$RepoRoot\scripts\distill.cjs" "$FcDir\scripts\distill.cjs" -Force
Write-Host "  + .form-context/scripts/distill.cjs"

# 3. Copy CLAUDE.md into .form-context/
Copy-Item "$RepoRoot\CLAUDE.md" "$FcDir\CLAUDE.md" -Force
Write-Host "  + .form-context/CLAUDE.md"

# 4. Copy slash command into .claude/commands/
$CommandsDir = Join-Path $TargetDir ".claude\commands"
New-Item -ItemType Directory -Force -Path $CommandsDir | Out-Null
Copy-Item "$RepoRoot\commands\fetch-form-model.md" "$CommandsDir\fetch-form-model.md" -Force
Write-Host "  + .claude/commands/fetch-form-model.md"

# 5. Gitignore .form-context/ entirely
$Gitignore = Join-Path $TargetDir ".gitignore"
if (Test-Path $Gitignore) {
    $content = Get-Content $Gitignore -Raw
    if ($content -notmatch [regex]::Escape(".form-context/")) {
        Add-Content $Gitignore "`n.form-context/"
        Write-Host "  + added .form-context/ to .gitignore"
    } else {
        Write-Host "  ~ .form-context/ already in .gitignore"
    }
} else {
    Set-Content $Gitignore ".form-context/"
    Write-Host "  + created .gitignore with .form-context/"
}

Write-Host ""
Write-Host "Done. Everything lives in .form-context/ (gitignored)."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Get your AEM cookie: DevTools -> Network -> any AEM request -> copy Cookie header value"
Write-Host "  2. Save it:  `"<paste-cookie>`" | Set-Content `"$FcDir\.aem-auth`""
Write-Host "  3. In Claude Code: /fetch-form-model <aem-form-url>"
