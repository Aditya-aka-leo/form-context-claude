# AEM Forms Context

This project uses a local form model cache under `forms/` to give Claude context about AEM form structure, field names, panel hierarchy, and rules — without needing to open AEM.

## How the cache works

```
forms/
└── <form-name>/
    ├── <form-name>.model.json   ← base form model (panels, fields, rules)
    ├── fragments.json           ← index of all fragments (name → content path)
    └── fragments/
        └── <fragment>.model.json  ← fetched on demand
```

`fragments.json` is always present after `/fetch-form-model` is run. Fragment model files are fetched and saved the first time they're needed.

## When to use form context

**Automatically check form context when:**
- A question involves a specific field, panel, or rule in a form
- You can't find a field name or variable in the JS/codebase — it may live in a fragment
- A bug or behavior is tied to a specific panel or section of the form
- The user mentions a fragment name, panel name, or field label

**Do not fetch form context for:**
- Pure JS/utility/infra questions unrelated to specific form fields
- Questions about the build system, dependencies, or non-form code

## How to fetch a fragment on demand

When the discussion involves a fragment and its model file doesn't exist yet:

1. Read `forms/<form-name>/fragments.json` to get the fragment's content path and base host
2. Read `.aem-auth` for the auth token
3. Fetch the fragment model:

```bash
AUTH=$(cat .aem-auth)
FRAGMENT_PATH="<fragment-content-path>"
BASE_HOST="<base-host>"
FORM_NAME="<form-name>"
FRAGMENT_NAME="<fragment-name>"

curl -s -H "Authorization: Bearer $AUTH" \
  "${BASE_HOST}${FRAGMENT_PATH}/jcr:content/root/section/form.model.json" \
  -o "forms/${FORM_NAME}/fragments/${FRAGMENT_NAME}.model.json"
```

If that returns a 401 or empty body, try:
```bash
curl -s -H "Cookie: login-token=$AUTH" \
  "${BASE_HOST}${FRAGMENT_PATH}/jcr:content/root/section/form.model.json" \
  -o "forms/${FORM_NAME}/fragments/${FRAGMENT_NAME}.model.json"
```

4. Read the saved file and use it for the current discussion

If the fragment model file already exists locally, just read it — no re-fetch needed.

## If .aem-auth is missing

Tell the user:
> "I need an AEM auth token to fetch fragment context. Paste your bearer token (DevTools → Network → any AEM request → Authorization header). I'll save it to `.aem-auth`."

Then save it to `.aem-auth`.

## Setting up for a new form

Run in Claude Code:
```
/fetch-form-model <aem-form-url>
```

This fetches the base form model and builds the fragment index. Fragments are then fetched automatically as needed during the session.
