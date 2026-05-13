# AEM Forms Context

This project caches AEM form models locally under `.form-context/` (gitignored) so Claude has field-level context when working on form logic — without polluting the project repo or burning context on noise.

---

## IMPORTANT: These files are READ-ONLY — never edit them

`.model.json`, `.summary.json`, and `.micro.json` are **cached copies** of the AEM JCR.
There is no POST API to push changes back. Editing them locally does nothing in AEM.

**Never modify these files.** If a bug fix requires changing a rule in AEM, use the Rule Editor guidance below to tell the user exactly what to change and where.

---

## File tiers (read in this order, stop when you have enough)

| Tier | File | Size | Use when |
|---|---|---|---|
| 1 | `<name>.micro.json` | ~5-65KB | First look — field index + non-trivial rules |
| 2 | `<name>.summary.json` | ~5-214KB | Full field details, events, visibility rules |
| 3 | `<name>.model.json` | raw, large | **Safety net** — always available locally, use if tiers 1-2 miss something |

Always start at tier 1 and escalate only as needed. `micro.json` is only generated when summary exceeds 20KB — for small fragments go straight to `summary.json`. The raw `model.json` is gitignored but present locally after fetch — it is the ground truth and loses nothing.

---

## When to fetch fragment context

**Trigger: you encounter a field name, variable, or `dataRef` in the JS that you cannot locate in the source files.**

Fetch only the fragment relevant to the current question. One fragment per issue is the norm. Do NOT pre-load all fragments.

**Also trigger when:**
- A bug involves a panel or section whose fields you can't see in the JS
- A rule references a field not defined in the file you're reading
- The user mentions a specific fragment or panel by name

**Do NOT trigger when:**
- The bug is purely in JS utility logic with no form field references
- You already have the fragment loaded in this session

---

## Known gotchas — read before using context files

### 1. Cryptic component keys vs semantic names
In `summary.json`, items are stored under AEM-generated keys like `panelcontainer_1267050063`. The actual semantic name is the `name` property inside the object. In `micro.json`, the `panel` field uses the semantic `name`, not the generated key.

**Rule:** When a rule or bug references `customerConsentWrapper`, search for `"name": "customerConsentWrapper"` in summary.json — not the top-level key.

---

### 2. Cross-fragment rule references
Rules in one fragment often dispatch events to fields in OTHER fragments or the base form, using dot notation:
```
dispatchEvent($form.hiddenKYCStatus, 'custom:setProperty', ...)
dispatchEvent($form.gstItrFragment.gstVerifyPanel, ...)
```

**Rule:** If a rule references `$form.<fieldName>` and that field isn't in the current fragment, it's in the **base form's hidden fields panel**. If it references `$form.<fragmentName>.<fieldName>`, look up that fragment in `fragments.json` and fetch it.

---

### 3. Truncated rules in micro.json
Rules in `micro.json` are cut at 300 characters. Truncated rules are marked with `…[TRUNCATED: read summary.json]`.

**Rule:** If you see `…[TRUNCATED: read summary.json]` — do exactly that. Do not guess the rest of the expression. Nested `if/if`, `awaitFn`, `retryHandler`, and multi-condition rules are especially prone to truncation.

---

### 4. Fragment stubs don't show full initialization state
Fragment stubs in the base form `summary.json` capture `visible: false` and `enabled: false` when set statically. But many fragments start visible and get hidden/shown dynamically via rules.

**Rule:** To find the real initial state of a fragment, search the base form `micro.json` rules for:
- `field: "<wrapperPanelName>"` with `event: "initialize"` — this is where show/hide logic is set up
- `dispatchEvent($form.<fragmentName>, 'custom:setProperty', {visible: ...})` — dynamic show/hide

---

### 5. No single form-level initialize event
There is no global `form.initialize`. Form setup is split across multiple field-level `initialize` events — typically on the first visible panel or wrapper.

**Rule:** To find what runs on form load, search `micro.json` rules for `"event": "initialize"`. The first few results are form-level setup. Critical state (journey type, hidden flags) is usually set here.

---

### 6. When micro.json is not enough — escalate to summary.json

Read `summary.json` when:
- A rule is marked `…[TRUNCATED]`
- Tracing nested conditionals (`if(if(if(...)))`)
- Debugging `awaitFn`, `retryHandler`, or `requestWithRetry` chains
- Looking for which specific sub-panel contains a field
- Cross-fragment references that need full path context
- Investigating `visible`/`enabled` conditions on nested panels

Read `model.json` only when:
- You need the raw component IDs to correlate with AEM author UI
- The summary still doesn't show a specific field you know exists
- A rule attached to a `plain-text` or `image` component is suspected (these are stripped from distilled files)
- You want to verify nothing was lost in distillation

**The raw `model.json` is always available locally** (gitignored but present after fetch). Read it directly:
```bash
# Base form
.form-context/forms/<form-name>/<form-name>.model.json

# Fragment
.form-context/forms/<form-name>/fragments/<fragment-name>.model.json
```

If the file doesn't exist locally (not yet fetched), re-fetch it:
```bash
COOKIE=$(cat .form-context/.aem-auth)
curl -s -H "Cookie: $COOKIE" \
  "<baseHost><contentPath>/jcr:content/root/section/form.model.json" | node -e "
  const d=[];
  process.stdin.on('data',c=>d.push(c));
  process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d.join('')),null,2)));
" > ".form-context/forms/<form-name>/fragments/<name>.model.json"
```

---

### 7. Fragment visibility is state-driven
Fragments are not simply on/off. Their visibility depends on form state variables (hidden fields like `hiddenJourneyName`, `hiddenKYCStatus`, `hiddenGSTSkipped`).

**Rule:** When a fragment isn't showing as expected, look for:
1. The wrapper panel name in base form `micro.json`
2. Its `initialize` event rule — it sets the starting state
3. Any `custom:setProperty` dispatch targeting that wrapper

---

## How to fetch a fragment on demand

1. Read `.form-context/forms/<form-name>/fragments.json` — find content path and base host
2. Check if `.micro.json` or `.summary.json` already exists — if yes, just read it
3. If not, fetch and distill:

```bash
COOKIE=$(cat .form-context/.aem-auth)
curl -s -H "Cookie: $COOKIE" \
  "<baseHost><fragmentPath>/jcr:content/root/section/form.model.json" | node -e "
  const d=[];
  process.stdin.on('data',c=>d.push(c));
  process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d.join('')),null,2)));
" > ".form-context/forms/<form>/fragments/<name>.model.json"

node .form-context/scripts/distill.cjs ".form-context/forms/<form>/fragments/<name>.model.json"
```

4. Read `.micro.json` if it exists, else `.summary.json`

---

## Reading strategy by token budget

| Situation | Read |
|---|---|
| Quick field lookup | `micro.json` only (~2-4K tokens) |
| Writing/fixing rule logic | `micro.json` → `summary.json` for affected panel only |
| Deep multi-panel bug | `summary.json` |
| Rule truncated or async chain | `summary.json` mandatory |
| Something still missing | `model.json` for that subtree |

Never load more than 2 fragment files into context at once unless the bug explicitly spans multiple fragments.

---

## If .aem-auth is missing or expired

If `.form-context/.aem-auth` is missing, tell the user:

> I need your AEM session cookie. Here's how to get it:
>
> 1. Open this URL in your browser — it will redirect you to AEM login:
>    `<base-host><content-path>/jcr:content/root/section/form.model.json`
> 2. Log in with your AEM credentials.
> 3. After login, open DevTools (F12) → **Network** tab → click any request
>    → **Request Headers** → find the `Cookie:` header → copy the **entire value**.
> 4. Paste it here.

When the user pastes the cookie, **use the Write tool** to save it to `.form-context/.aem-auth`.

If a fetch returns non-JSON (curl returns an HTML login page), the auth token is expired. Apply the same recovery flow — show the JCR URL, ask for a fresh cookie, **use the Write tool** to overwrite `.form-context/.aem-auth`, then retry automatically.

---

## Fixing rules in AEM — Rule Editor steps

When a bug fix requires modifying an AEM form rule, **do NOT attempt to edit `.model.json`** — it is a read-only cache. There is no API to push changes back to AEM.

Instead, provide the user with these steps:

### Step 1 — Open the Rule Editor

**For a field in the base form:**
1. Go to: `<base-host>/aem/forms.html<parent-folder-path>`
   (e.g. `https://author-xxx.adobeaemcloud.com/aem/forms.html/content/forms/af/hdfc/loans/assisted/bl`)
2. Hover over the form → click **Edit**
3. In the form editor, click on the field: **`<fieldName>`**
4. In the top toolbar, click the **Rule Editor** icon (lightning bolt ⚡)

**For a field inside a fragment:**
1. Go to: `<base-host>/aem/forms.html<fragment-parent-folder-path>`
2. Hover over the fragment → click **Edit**
3. In the fragment editor, click on the field: **`<fieldName>`**
4. Click the **Rule Editor** icon

### Step 2 — Find the rule to change

- Select the field: **`<fieldName>`** in the Rule Editor panel
- Look for the event: **`<eventName>`** (e.g. `initialize`, `click`, `custom:someEvent`)
- The current expression is:
  ```
  <paste current expression from summary.json>
  ```

### Step 3 — Replace with

```
<paste the exact new expression the user should enter>
```

---

**Always include in your Rule Editor guidance:**
- The exact field `name` (the semantic name from `summary.json`, NOT the AEM-generated key)
- The event type (`initialize`, `click`, etc.)
- Whether it's in the base form or a fragment — and which fragment
- The current expression (from `summary.json`) vs. the new expression
- The AEM Forms console URL so the user can navigate directly

---

## Cache structure

Everything lives under `.form-context/` — gitignored, never goes into the project repo.

```
.form-context/                          ← gitignored entirely
├── .aem-auth                           ← AEM session cookie
├── scripts/
│   └── distill.cjs
└── forms/
    └── <form-name>/
        ├── <form-name>.model.json      ← raw (ground truth) — READ ONLY
        ├── <form-name>.summary.json    ← distilled — READ ONLY
        ├── <form-name>.micro.json      ← field index — READ ONLY
        ├── fragments.json              ← fragment index
        └── fragments/
            ├── <name>.model.json       ← raw — READ ONLY
            ├── <name>.summary.json     ← distilled — READ ONLY
            └── <name>.micro.json       ← large fragments only — READ ONLY
```

## Setting up for a new form

```
/fetch-form-model <aem-form-url>
```
