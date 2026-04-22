#!/usr/bin/env node
// Distills a full AEM form model JSON into:
//   <name>.summary.json  — all fields/rules/events, noise stripped (~70% smaller)
//   <name>.micro.json    — field index + non-trivial rules only (auto-generated for summaries >20KB)
//
// Usage: node distill.js <input.model.json>

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node distill.js <input.model.json>');
  process.exit(1);
}

const model = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const base = inputPath.replace('.model.json', '');

// ─── Summary pass ────────────────────────────────────────────────────────────

const KEEP_KEYS = ['name', 'dataRef', 'fieldType', 'type', 'label', 'visible',
  'enabled', 'readOnly', 'repeatable', 'default', 'enum', 'enumNames',
  'required', 'maxLength', 'minLength', 'events', 'rules'];
const SKIP_TYPES = ['plain-text', 'image'];

function distillLabel(label) {
  return label?.value || label?.richText || undefined;
}

function distillEvents(events) {
  if (!events || typeof events !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(events)) {
    const exprs = (Array.isArray(v) ? v : [v]).filter(Boolean);
    if (exprs.length) out[k] = exprs.length === 1 ? exprs[0] : exprs;
  }
  return Object.keys(out).length ? out : undefined;
}

function distillField(item) {
  if (SKIP_TYPES.includes(item.fieldType)) return null;

  // Fragment boundary — emit stub, do not expand inline content
  if (item.fragmentPath) {
    const stub = {
      name:         item.name,
      fragmentRef:  item.fragmentPath.split('/').pop(),
      fragmentPath: item.fragmentPath,
    };
    if (item.visible  === false) stub.visible  = false;
    if (item.enabled  === false) stub.enabled  = false;
    if (item.readOnly === true)  stub.readOnly  = true;
    const e = distillEvents(item.events);
    if (e) stub.events = e;
    return stub;
  }

  const out = {};
  for (const key of KEEP_KEYS) {
    if (item[key] == null) continue;
    if (key === 'label')   { const l = distillLabel(item.label); if (l) out.label = l; }
    else if (key === 'events') { const e = distillEvents(item.events); if (e) out.events = e; }
    else if (key === 'visible'    && item.visible    === true)  continue;
    else if (key === 'enabled'    && item.enabled    === true)  continue;
    else if (key === 'readOnly'   && item.readOnly   === false) continue;
    else if (key === 'repeatable' && item.repeatable === false) continue;
    else out[key] = item[key];
  }
  const fdRules = item.properties?.['fd:rules'];
  if (fdRules && Object.keys(fdRules).length) out.rules = fdRules;
  if (item[':items']) {
    const children = distillItems(item[':items']);
    if (children && Object.keys(children).length) out.items = children;
  }
  return out;
}

function distillItems(items) {
  if (!items || typeof items !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(items)) {
    if (!v || typeof v !== 'object') continue;
    const d = distillField(v);
    if (d && Object.keys(d).length) out[k] = d;
  }
  return out;
}

const summary = JSON.parse(JSON.stringify({
  title: model.title,
  path: model.properties?.['fd:path'],
  items: distillItems(model[':items']),
}));

const summaryPath = `${base}.summary.json`;
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

const inSize  = fs.statSync(inputPath).size;
const sumSize = fs.statSync(summaryPath).size;
console.log(`${path.basename(inputPath)} → ${path.basename(summaryPath)}  ${kb(inSize)} → ${kb(sumSize)}  (${pct(inSize, sumSize)}% smaller)`);

// ─── Micro pass (only if summary > 20KB) ─────────────────────────────────────

const MICRO_THRESHOLD = 20 * 1024;

if (sumSize > MICRO_THRESHOLD) {
  const fields = [];   // { panel, name, dataRef, fieldType, label }
  const rules  = [];   // { field, event, expression } — non-trivial only

  function scanMicro(obj, panelPath) {
    if (!obj || typeof obj !== 'object') return;

    const isField = obj.fieldType && obj.fieldType !== 'panel' && obj.fieldType !== 'form';
    if (isField && obj.name) {
      fields.push(compact({
        panel:     panelPath || null,
        name:      obj.name,
        dataRef:   obj.dataRef,
        fieldType: obj.fieldType,
        label:     distillLabel(obj.label),
        readOnly:  obj.readOnly === true ? true : undefined,
        required:  obj.required === true ? true : undefined,
        visible:   obj.visible  === false ? false : undefined,
        enabled:   obj.enabled  === false ? false : undefined,
      }));
    }

    // capture non-trivial events (skip bare "$event.payload" passthroughs)
    if (obj.events) {
      for (const [evt, expr] of Object.entries(obj.events)) {
        const exprStr = Array.isArray(expr) ? expr.join(' | ') : String(expr);
        if (exprStr.length > 20 && !exprStr.match(/^\$event\.payload$/)) {
          const truncated = exprStr.length > 300;
          rules.push({ field: obj.name || panelPath, event: evt, expr: exprStr.slice(0, 300) + (truncated ? '…[TRUNCATED: read summary.json]' : '') });
        }
      }
    }

    if (obj.items) {
      const nextPanel = obj.name || panelPath;
      for (const child of Object.values(obj.items)) scanMicro(child, nextPanel);
    }
  }

  if (summary.items) {
    for (const child of Object.values(summary.items)) scanMicro(child, null);
  }

  const micro = { title: summary.title, path: summary.path, fields, rules };
  const microPath = `${base}.micro.json`;
  fs.writeFileSync(microPath, JSON.stringify(micro, null, 2));

  const microSize = fs.statSync(microPath).size;
  console.log(`  → ${path.basename(microPath)}  ${kb(microSize)}  (micro index)`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kb(n)  { return `${(n/1024).toFixed(1)}KB`; }
function pct(a, b) { return Math.round((1 - b/a) * 100); }
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}
