#!/usr/bin/env node
// Distills a full AEM form model JSON into a compact summary for Claude context.
// Usage: node distill.js <input.model.json> [output.summary.json]

const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3] || inputPath.replace('.model.json', '.summary.json');

if (!inputPath) {
  console.error('Usage: node distill.js <input.model.json> [output.summary.json]');
  process.exit(1);
}

const model = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const KEEP_FIELD_KEYS = ['name', 'dataRef', 'fieldType', 'type', 'label', 'visible', 'enabled', 'readOnly', 'repeatable', 'default', 'enum', 'enumNames', 'required', 'maxLength', 'minLength', 'events', 'rules'];
const SKIP_FIELD_TYPES = ['plain-text', 'image'];

function distillLabel(label) {
  if (!label) return undefined;
  return label.value || label.richText || undefined;
}

function distillEvents(events) {
  if (!events || typeof events !== 'object') return undefined;
  const result = {};
  for (const [k, v] of Object.entries(events)) {
    const exprs = Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean);
    if (exprs.length) result[k] = exprs.length === 1 ? exprs[0] : exprs;
  }
  return Object.keys(result).length ? result : undefined;
}

function distillField(item) {
  // skip display-only, no-logic components
  if (SKIP_FIELD_TYPES.includes(item.fieldType)) return null;

  const out = {};

  for (const key of KEEP_FIELD_KEYS) {
    if (item[key] === undefined || item[key] === null) continue;
    if (key === 'label') { const l = distillLabel(item.label); if (l) out.label = l; }
    else if (key === 'events') { const e = distillEvents(item.events); if (e) out.events = e; }
    else if (key === 'visible' && item.visible === true) continue;
    else if (key === 'enabled' && item.enabled === true) continue;
    else if (key === 'readOnly' && item.readOnly === false) continue;
    else if (key === 'repeatable' && item.repeatable === false) continue;
    else out[key] = item[key];
  }

  // rules from properties
  const rules = item.properties?.['fd:rules'];
  if (rules && typeof rules === 'object' && Object.keys(rules).length) {
    out.rules = rules;
  }

  // recurse into children
  if (item[':items']) {
    const children = distillItems(item[':items']);
    if (children && Object.keys(children).length) out.items = children;
  }

  return out;
}

function distillItems(items) {
  if (!items || typeof items !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(items)) {
    if (!value || typeof value !== 'object') continue;
    const distilled = distillField(value);
    if (distilled && Object.keys(distilled).length) out[key] = distilled;
  }
  return out;
}

const summary = {
  title: model.title,
  fieldType: model.fieldType,
  path: model.properties?.['fd:path'],
  items: distillItems(model[':items']),
};

// strip undefined recursively
const clean = JSON.parse(JSON.stringify(summary));

fs.writeFileSync(outputPath, JSON.stringify(clean, null, 2));

const inSize = fs.statSync(inputPath).size;
const outSize = fs.statSync(outputPath).size;
const pct = Math.round((1 - outSize / inSize) * 100);
console.log(`${require('path').basename(inputPath)} → ${require('path').basename(outputPath)}`);
console.log(`  ${(inSize/1024).toFixed(1)}KB → ${(outSize/1024).toFixed(1)}KB  (${pct}% smaller)`);
