# fetch-form-model

Fetches an AEM form's model JSON and all its fragment model JSONs, then saves them locally under `forms/<form-name>/` so Claude has full context of form rules and structure.

## Usage

```
/fetch-form-model <aem-form-url-or-content-path>
```

**Examples:**
```
/fetch-form-model https://author-p153560-e1607906.adobeaemcloud.com/content/forms/af/hdfc/loans/assisted/bl/customer-form.html
/fetch-form-model /content/forms/af/hdfc/loans/assisted/bl/customer-form
```

## Instructions

When this command is invoked with `$ARGUMENTS`, follow these steps exactly:

### Step 1 — Parse the input

Extract:
- **Base host**: e.g. `https://author-p153560-e1607906.adobeaemcloud.com`
- **Content path**: e.g. `/content/forms/af/hdfc/loans/assisted/bl/customer-form`
  - Strip `.html` suffix if present
  - Strip the UI hash fragment (`/ui#/@.../canvas/`) and everything before the `/content/` part if a full editor URL is given
- **Form name**: last segment of the content path, e.g. `customer-form`

### Step 2 — Resolve auth

Check for an auth token in this order:
1. File `.aem-auth` at the repo root — read first line as the bearer token
2. Environment variable `AEM_AUTH` — use as bearer token
3. If neither exists, ask the user:
   > "I need an AEM auth token to fetch the model. Please paste your bearer token or cookie value (you can get it from DevTools → Network → any AEM request → Authorization or Cookie header). I'll save it to `.aem-auth` for future use."
   Then save their response to `.aem-auth` (and ensure `.aem-auth` is in `.gitignore`).

### Step 3 — Fetch the base form model

Construct the model URL:
```
<base-host><content-path>/jcr:content/root/section/form.model.json
```

Fetch it using Bash with curl:
```bash
curl -s -H "Authorization: Bearer <token>" "<model-url>"
```

If that returns a 401 or empty body, try with cookie header instead:
```bash
curl -s -H "Cookie: login-token=<token>" "<model-url>"
```

Save the raw JSON to:
```
forms/<form-name>/<form-name>.model.json
```

### Step 4 — Find all fragment references

Parse the saved model JSON and look for all occurrences of fragment references. Fragments appear as component entries with any of these patterns:
- Property `"fd:fragment"` with a content path value
- Property `"fragmentPath"` with a content path value  
- Property `":type"` containing `"fragment"` and a nearby `"value"` or `"path"` property
- Any string value matching the pattern `/content/forms/af/.*/fragments/.*` or `/content/dam/formsanddocuments/.*`

Use this bash to extract all candidate paths:
```bash
grep -oE '"[^"]*(/content/forms/af/[^"]*|/content/dam/formsanddocuments/[^"]*)"' forms/<form-name>/<form-name>.model.json | grep -v '\.html' | sort -u
```

Also do a broader search for any content path that looks like a fragment:
```bash
grep -oE '/content/[^"]+' forms/<form-name>/<form-name>.model.json | grep -v '\.model\.json' | sort -u
```

List all found fragment paths to the user and ask them to confirm which ones are actual fragments if it's unclear.

### Step 5 — Fetch each fragment model

For each fragment content path found, construct its model URL using the same pattern:
```
<base-host><fragment-content-path>/jcr:content/root/section/form.model.json
```

Fetch it the same way as Step 3. Save to:
```
forms/<form-name>/fragments/<fragment-name>.model.json
```

Where `<fragment-name>` is the last path segment of the fragment content path.

If a fragment fetch fails (404 or auth error), log it but continue with the others.

### Step 6 — Build the context index

After all fetches, create or update `forms/<form-name>/index.md` with:

```markdown
# <form-name> — Form Context

**Content path:** <content-path>  
**Fetched:** <current date/time>

## Base Form
- [<form-name>.model.json](./<form-name>.model.json)

## Fragments
- [<fragment-name>](./fragments/<fragment-name>.model.json) — `<fragment-content-path>`
...

## How to use
When working on rules or logic for this form, read these model files to understand
field names, panel structure, rules, and fragment composition before editing JS files.
```

### Step 7 — Report to user

Print a summary:
```
Saved form context for <form-name>:
  forms/<form-name>/<form-name>.model.json         (base form)
  forms/<form-name>/fragments/<name>.model.json    (N fragments)
  forms/<form-name>/index.md                       (context index)

To load this context in future sessions, tell Claude:
  "Read forms/<form-name>/index.md and all files it references"
```

## Notes

- `.aem-auth` is gitignored — never commit auth tokens
- Fragment model URLs use the same `/jcr:content/root/section/form.model.json` suffix pattern
- If the form uses a different model path suffix (e.g. `/jcr:content/guideContainer.model.json`), try that as a fallback
- Run this command again to refresh/update the saved models
