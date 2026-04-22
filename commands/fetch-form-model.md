# fetch-form-model

Fetches an AEM form's base model JSON and builds a fragment index. Fragments are fetched on-demand only when the discussion requires them.

All files are stored under `.form-context/` (gitignored — never pollutes the project repo).

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
1. File `.form-context/.aem-auth` — use entire contents as the `Cookie` header value
2. Environment variable `AEM_AUTH`
3. If neither exists, ask the user:
   > "I need your AEM session cookie. In Chrome DevTools on the AEM tab: Network → click any request → Request Headers → copy the full `Cookie:` header value. Paste it here and I'll save it to `.form-context/.aem-auth`."

   Save their response to `.form-context/.aem-auth`. It is already gitignored via `.form-context/`.

### Step 3 — Fetch the base form model

Construct the model URL:
```
<base-host><content-path>/jcr:content/root/section/form.model.json
```

Fetch, prettify, and save:
```bash
COOKIE=$(cat .form-context/.aem-auth)
mkdir -p .form-context/forms/<form-name>
curl -s -H "Cookie: $COOKIE" "<model-url>" | node -e "
  const d=[];
  process.stdin.on('data',c=>d.push(c));
  process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d.join('')),null,2)));
" > .form-context/forms/<form-name>/<form-name>.model.json
```

Then distill:
```bash
node .form-context/scripts/distill.js .form-context/forms/<form-name>/<form-name>.model.json
```

### Step 4 — Build the fragment index (do NOT fetch fragments yet)

```bash
node -e "
const fs = require('fs');
const model = JSON.parse(fs.readFileSync('.form-context/forms/<form-name>/<form-name>.model.json', 'utf8'));
const fragments = {};
function scan(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'fragmentPath' && typeof v === 'string' && v.startsWith('/content/'))
      fragments[v.split('/').pop()] = v;
    if (typeof v === 'object') scan(v);
    if (Array.isArray(v)) v.forEach(scan);
  }
}
scan(model);
const index = { form: '<form-name>', contentPath: '<content-path>', baseHost: '<base-host>', fragments };
fs.writeFileSync('.form-context/forms/<form-name>/fragments.json', JSON.stringify(index, null, 2));
console.log('Fragments found:', Object.keys(fragments).length);
Object.entries(fragments).forEach(([n]) => console.log(' -', n));
"
```

### Step 5 — Report to user

```
Loaded base form: .form-context/forms/<form-name>/<form-name>.model.json
Fragment index:   .form-context/forms/<form-name>/fragments.json

Found N fragments (not fetched yet):
  - <fragment-name>  →  <fragment-content-path>
  ...

Fragments will be fetched on demand when relevant to the discussion.
Everything is in .form-context/ — gitignored, not in the project repo.
```

---

## On-demand fragment fetching

During any conversation where a specific fragment is relevant, Claude should:

1. Check `.form-context/forms/<form-name>/fragments.json` for the fragment's content path
2. If `.form-context/forms/<form-name>/fragments/<name>.micro.json` or `.summary.json` already exists — just read it, skip fetch
3. If not, fetch and distill:

```bash
COOKIE=$(cat .form-context/.aem-auth)
mkdir -p .form-context/forms/<form-name>/fragments
curl -s -H "Cookie: $COOKIE" \
  "<base-host><fragment-path>/jcr:content/root/section/form.model.json" | node -e "
  const d=[];
  process.stdin.on('data',c=>d.push(c));
  process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d.join('')),null,2)));
" > ".form-context/forms/<form-name>/fragments/<name>.model.json"

node .form-context/scripts/distill.js ".form-context/forms/<form-name>/fragments/<name>.model.json"
```

Read `.micro.json` if it exists, else `.summary.json`. Fall back to full `.model.json` only if needed.

---

## Notes

- All files live in `.form-context/` — gitignored, never goes into the project repo
- Re-run `/fetch-form-model` to refresh the base form and rebuild the fragment index
- To force-refresh a fragment, delete its file — Claude will re-fetch on next reference
- Fallback model URL suffix: `/jcr:content/guideContainer.model.json` if the default returns 404
