# aem-forms-context

Claude Code skills for fetching AEM Forms model JSON (including all fragments) and saving them locally so Claude has full context of form rules and structure when working in the codebase.

## What it does

When you run `/fetch-form-model <aem-url>`, Claude will:

1. Fetch the base form's `.model.json` from AEM
2. Scan it for all fragment references
3. Fetch each fragment's `.model.json`
4. Save everything under `forms/<form-name>/`
5. Generate an `index.md` so you can load the context in future sessions

```
forms/
└── customer-form/
    ├── customer-form.model.json     ← base form model
    ├── index.md                     ← context index
    └── fragments/
        ├── personal-details.model.json
        ├── kyc-details.model.json
        └── ...
```

## Install into a project

```bash
# From the project root (e.g. forms-engine/)
bash /path/to/aem-forms-context/scripts/install.sh

# Or clone and install
git clone https://github.com/Aditya-aka-leo/aem-forms-context.git
bash aem-forms-context/scripts/install.sh /path/to/your/project
```

This copies the command files into `.claude/commands/` and adds `.aem-auth` to `.gitignore`.

## Usage

In Claude Code, inside your project:

```
/fetch-form-model https://author-p153560-e1607906.adobeaemcloud.com/content/forms/af/hdfc/loans/assisted/bl/customer-form.html
```

On first run, Claude will ask for your AEM bearer token or cookie (get it from DevTools → Network → any AEM request → Authorization header). It saves to `.aem-auth` (gitignored) for subsequent runs.

### Loading context in a session

At the start of a session where you need form context:

```
Read forms/customer-form/index.md and all files it references
```

Claude will then have full knowledge of the form's field names, panel structure, rules, and fragment composition alongside the codebase.

## Auth

Your token is stored in `.aem-auth` at the project root — this file is gitignored and never committed. To refresh it, delete `.aem-auth` and run `/fetch-form-model` again.

## Adding new forms

Just run `/fetch-form-model` with a different form URL — it creates a separate folder under `forms/` for each form.
