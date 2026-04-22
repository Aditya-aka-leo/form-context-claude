# fetch-form-model

Fetches an AEM form's base model JSON and builds a fragment index. Fragments are fetched on-demand only when the discussion requires them.

## Usage

```
/fetch-form-model <aem-form-url-or-content-path>
```

**Examples:**
```
/fetch-form-model https://author-p153560-e1607906.adobeaemcloud.com/content/forms/af/hdfc/loans/assisted/bl/customer-form.html
/fetch-form-model /content/forms/af/hdfc/loans/assisted/bl/customer-form
```

---

## Instructions

When this command is invoked with `$ARGUMENTS`, follow these steps:

### Step 1 — Parse the input

Extract:
- **Base host**: e.g. `https://author-p153560-e1607906.adobeaemcloud.com`
- **Content path**: e.g. `/content/forms/af/hdfc/loans/assisted/bl/customer-form`
  - Strip `.html` suffix if present
  - If given a full editor URL (`/ui#/@.../canvas/...`), extract the part starting from `/content/`
- **Form name**: last segment of the content path, e.g. `customer-form`

### Step 2 — Resolve auth

Check in this order:
1. File `.aem-auth` at the project root — use first line as bearer token
2. Environment variable `AEM_AUTH`
3. If neither exists, ask the user:
   > "I need an AEM auth token to fetch the model. Paste your bearer token or cookie value (DevTools → Network → any AEM request → Authorization header). I'll save it to `.aem-auth` for future use."

   Save their response to `.aem-auth` and ensure `.aem-auth` is in `.gitignore`.

### Step 3 — Fetch the base form model only

Construct the model URL:
```
<base-host><content-path>/jcr:content/root/section/form.model.json
```

Fetch using curl:
```bash
curl -s -H "Authorization: Bearer <token>" "<model-url>"
```

If 401 or empty, retry with cookie header:
```bash
curl -s -H "Cookie: login-token=<token>" "<model-url>"
```

Save to:
```
forms/<form-name>/<form-name>.model.json
```

### Step 4 — Build the fragment index (do NOT fetch fragments yet)

Scan the saved model JSON for fragment references. Look for:
- `"fd:fragment"` property values
- `"fragmentPath"` property values
- Any string matching `/content/forms/af/.*/fragments/.*` or `/content/dam/formsanddocuments/.*`

```bash
grep -oE '"/content/forms/af/[^"]*"' forms/<form-name>/<form-name>.model.json | tr -d '"' | grep -v '<form-name>' | sort -u
```

Write the index to `forms/<form-name>/fragments.json`:
```json
{
  "form": "<form-name>",
  "contentPath": "<content-path>",
  "baseHost": "<base-host>",
  "fragments": {
    "<fragment-name>": "<fragment-content-path>",
    ...
  }
}
```

### Step 5 — Report to user

Print:
```
Loaded base form: forms/<form-name>/<form-name>.model.json
Fragment index:   forms/<form-name>/fragments.json

Found N fragments (not fetched yet):
  - <fragment-name>  →  <fragment-content-path>
  ...

Fragments will be fetched on demand when relevant to the discussion.
```

---

## On-demand fragment fetching

**This is the key behavior.** During any conversation where a specific fragment is relevant (user mentions it, a rule references it, or a field name only exists in that fragment), Claude should:

1. Check `forms/<form-name>/fragments.json` for the fragment's content path
2. If the fragment model file does NOT already exist locally at `forms/<form-name>/fragments/<fragment-name>.model.json`, fetch it:

```bash
# Read auth token
AUTH=$(cat .aem-auth)

# Fetch fragment model
curl -s -H "Authorization: Bearer $AUTH" \
  "<base-host><fragment-content-path>/jcr:content/root/section/form.model.json" \
  -o "forms/<form-name>/fragments/<fragment-name>.model.json"
```

3. Read and use the saved fragment model for the current discussion

If the file already exists, just read it — no re-fetch needed.

---

## Notes

- `.aem-auth` is gitignored — never commit auth tokens
- Re-run `/fetch-form-model` to refresh the base form and rebuild the fragment index
- To force-refresh a specific fragment, delete its file and Claude will re-fetch on next reference
- The fragment model URL uses the same `/jcr:content/root/section/form.model.json` suffix; fallback to `/jcr:content/guideContainer.model.json` if 404
