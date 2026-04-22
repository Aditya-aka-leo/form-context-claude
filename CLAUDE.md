# AEM Forms Context

This project caches AEM form models locally under `forms/` so Claude has field-level context when working on form logic — without burning context on noise.

## File tiers (read in this order)

Each fragment has up to three files. Always start from the smallest:

| File | Size | Use when |
|---|---|---|
| `<name>.micro.json` | ~5-15KB | First look — field index + non-trivial rules |
| `<name>.summary.json` | ~5-70KB | Need field details, events, visibility rules |
| `<name>.model.json` | raw, large | Deep debugging only, avoid unless necessary |

`micro.json` is only generated for fragments whose summary exceeds 20KB. For small fragments, go straight to `summary.json`.

## When to fetch fragment context

**Trigger: you encounter a field name, variable, or `dataRef` in the JS/codebase that you cannot locate in the source files.**

Do NOT pre-emptively load all fragments. Fetch only the fragment that is relevant to the current bug or question. One fragment per issue is the norm.

**Also trigger when:**
- A bug involves a panel or section whose fields you can't see in the JS
- A rule references a field that isn't defined in the file you're looking at
- The user mentions a specific fragment by name

**Do NOT trigger when:**
- The bug is purely in JS logic with no form field references
- You already have the fragment loaded in this session

## How to fetch a fragment on demand

1. Read `forms/<form-name>/fragments.json` — find the fragment's content path and base host
2. Check if `forms/<form-name>/fragments/<name>.micro.json` or `.summary.json` already exists — if yes, just read it, skip the fetch
3. If not, fetch and distill:

```bash
COOKIE=$(cat .aem-auth)
FRAG_PATH="<fragment-content-path>"
BASE_HOST="<base-host>"
FORM="<form-name>"
NAME="<fragment-name>"

curl -s -H "Cookie: $COOKIE" \
  "${BASE_HOST}${FRAG_PATH}/jcr:content/root/section/form.model.json" | node -e "
  const d=[];
  process.stdin.on('data',c=>d.push(c));
  process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d.join('')),null,2)));
" > "forms/${FORM}/fragments/${NAME}.model.json"

node scripts/distill.js "forms/${FORM}/fragments/${NAME}.model.json"
```

4. Read `<name>.micro.json` if it exists, otherwise `<name>.summary.json`
5. Use the context to answer the question or write the fix

## Reading strategy by token budget

| Situation | Read |
|---|---|
| Quick question about a field | `micro.json` only |
| Writing/fixing rule logic | `micro.json` first, then `summary.json` for the specific panel |
| Deep bug across multiple panels | `summary.json` |
| Something doesn't add up after summary | `model.json` for that specific subtree |

Never load more than 2 fragment files into context at once unless the bug explicitly spans multiple fragments.

## If .aem-auth is missing

Tell the user:
> "I need your AEM session cookie. In Chrome DevTools on the AEM tab: Network → click any request → Request Headers → copy the full `Cookie:` header value. Paste it here and I'll save it to `.aem-auth`."

Save their response to `.aem-auth`.

## Cache structure

```
forms/
└── <form-name>/
    ├── <form-name>.model.json     ← raw (gitignored)
    ├── fragments.json             ← index of all fragments
    └── fragments/
        ├── <name>.model.json      ← raw (gitignored)
        ├── <name>.summary.json    ← distilled, committed
        └── <name>.micro.json      ← field index, committed (large fragments only)
```

## Setting up for a new form

```
/fetch-form-model <aem-form-url>
```
