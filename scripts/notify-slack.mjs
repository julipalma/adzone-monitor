import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const webhookUrl     = process.env.SLACK_WEBHOOK_URL?.trim();
if (!webhookUrl) {
  console.log('notify-slack: SLACK_WEBHOOK_URL no definido; omito envío.');
  process.exit(0);
}

const logPath        = process.env.CHANGELOG_PATH    || join(ROOT, 'logs/changes.log');
const snapshotPath   = join(ROOT, 'data/snapshot.json');
const repo           = process.env.GITHUB_REPOSITORY  || 'repo/desconocido';
const server         = process.env.GITHUB_SERVER_URL   || 'https://github.com';
const runId          = process.env.GITHUB_RUN_ID       || '';
const monitorOutcome = process.env.MONITOR_OUTCOME     || 'success';

// ── Parse changes.log ──────────────────────────────────────────────────────────

/**
 * Convierte el log en un array de entradas estructuradas.
 * Cada entrada: { ts, id, message, body[], type }
 * type: 'baseline' | 'disappeared' | 'diff' | 'change' | 'unknown'
 */
function parseLog(raw) {
  const lines = raw.split('\n');
  const entries = [];
  let cur = null;

  for (const line of lines) {
    if (line.startsWith('[') && line.includes('] ')) {
      if (cur) entries.push(cur);
      const m = line.match(/^\[([^\]]+)\] ([^:]+): ([\s\S]*)$/);
      if (!m) { cur = null; continue; }
      cur = { ts: new Date(m[1]), id: m[2].trim(), message: m[3].trim(), body: [] };
    } else if (cur && line && !line.startsWith('#')) {
      cur.body.push(line);
    }
  }
  if (cur) entries.push(cur);

  return entries.map(e => ({ ...e, type: classify(e.message) }));
}

function classify(msg) {
  if (msg.includes('primera medición')) return 'baseline';
  if (msg.includes('ya no aparece'))    return 'disappeared';
  if (msg.includes('diff unificado'))   return 'diff';
  if (msg.includes(' → '))             return 'change';
  return 'unknown';
}

/** Extrae datos estructurados de la línea de resumen de un cambio. */
function parseChangeSummary(msg) {
  const r = {};

  const b = msg.match(/bytes (\d+) → (\d+)/);
  if (b) {
    r.bytesOld   = +b[1];
    r.bytesNew   = +b[2];
    r.bytesDelta = r.bytesNew - r.bytesOld;
  }

  const h = msg.match(/hints (\{[^}]+\}) → (\{[^}]+\})/);
  if (h) {
    try { r.hintsOld = JSON.parse(h[1]); } catch {}
    try { r.hintsNew = JSON.parse(h[2]); } catch {}
  }

  return r;
}

// ── Extraer insights del diff ──────────────────────────────────────────────────

/**
 * A partir de las líneas del diff almacenado, extrae cambios significativos:
 *  1. Líneas cortas modificadas (comentarios de versión, etc.)
 *  2. Cache-busters en URLs
 *  3. Cambios de nombres de funciones/métodos en código minificado (best-effort)
 */
function extractInsights(diffLines) {
  const removed = [], added = [];
  for (const line of diffLines) {
    if (!line || /^(---|\+\+\+|@@|\\)/.test(line)) continue;
    if (line[0] === '-') removed.push(line.slice(1));
    else if (line[0] === '+') added.push(line.slice(1));
  }

  const insights = [];

  // 1. Líneas cortas modificadas (< 80 chars)
  const shortR = removed.filter(l => l.trim().length > 0 && l.trim().length < 80);
  const shortA = added.filter(l => l.trim().length > 0 && l.trim().length < 80);
  for (let i = 0; i < Math.min(shortR.length, shortA.length); i++) {
    const before = shortR[i].trim(), after = shortA[i].trim();
    if (before !== after) insights.push({ type: 'line', before, after });
  }

  // 2. Cache-busters: misma URL base, distinto query string
  const urlRe  = /https?:\/\/[^\s'"]+\.js(?:\?[^\s'"<>]*)?/g;
  const oldUrls = new Set([...removed.join('\n').matchAll(urlRe)].map(m => m[0]));
  const newUrls = new Set([...added.join('\n').matchAll(urlRe)].map(m => m[0]));
  for (const ou of oldUrls) {
    const base = ou.replace(/\?.*$/, '');
    for (const nu of newUrls) {
      if (nu !== ou && nu.replace(/\?.*$/, '') === base) {
        insights.push({ type: 'cache-buster', before: ou, after: nu });
      }
    }
  }

  // 3. Cambios de métodos/funciones en código minificado
  const SKIP = new Set([
    'function','return','typeof','instanceof','undefined','continue','default',
    'document','console','window','Object','Array','String','Number','Boolean',
    'Math','Error','Promise','setTimeout','clearTimeout','setInterval','clearInterval',
    'addEventListener','removeEventListener','getElementById','querySelector',
    'querySelectorAll','appendChild','setAttribute','getAttribute','createElement',
    'innerHTML','hasOwnProperty','prototype','constructor','toString','valueOf',
    'getTargeting','postMessage','stringify','getTime','toISOString','replace',
    'indexOf','includes','startsWith','endsWith','split','slice','join','push',
    'filter','forEach','reduce','map','keys','values','entries','assign',
  ]);

  const fnRe   = /\b([a-zA-Z_][a-zA-Z0-9_]{7,})\s*\(/g;
  const allRem = removed.join('\n');
  const allAdd = added.join('\n');
  const rFns   = new Set([...allRem.matchAll(fnRe)].map(m => m[1]).filter(f => !SKIP.has(f)));
  const aFns   = new Set([...allAdd.matchAll(fnRe)].map(m => m[1]).filter(f => !SKIP.has(f)));

  const removedOnly = [...rFns].filter(f => !aFns.has(f));
  const addedOnly   = [...aFns].filter(f => !rFns.has(f));

  // Solo incluir si hay pocos cambios (evita ruido en diffs grandes)
  if (removedOnly.length >= 1 && removedOnly.length <= 3 && addedOnly.length <= 3) {
    for (let i = 0; i < Math.min(removedOnly.length, addedOnly.length, 2); i++) {
      insights.push({ type: 'fn-change', before: `${removedOnly[i]}()`, after: `${addedOnly[i]}()` });
    }
  }

  return insights;
}

function insightToText(ins) {
  if (ins.type === 'line') {
    if (/^\/\/\s*(v\s*)?\d+/.test(ins.before)) return null; // ya está en la versión
    if (/^\/\/\s*20\d\d/.test(ins.before))     return null; // ya está en el build
    return `\`${ins.before}\` → \`${ins.after}\``;
  }
  if (ins.type === 'cache-buster') {
    const file = ins.before.match(/\/([^/]+\.js)/)?.[1] ?? 'script';
    const oldQ = ins.before.match(/\?(.+)$/)?.[1] ?? ins.before;
    const newQ = ins.after.match(/\?(.+)$/)?.[1]  ?? ins.after;
    return `Cache-buster de \`${file}\`: \`?${oldQ}\` → \`?${newQ}\``;
  }
  if (ins.type === 'fn-change') {
    return `\`${ins.before}\` → \`${ins.after}\``;
  }
  return null;
}

// ── Formateo ───────────────────────────────────────────────────────────────────

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/** Formatea un Date a hora ARG (UTC-3), ej: "26 may 2026 · 19:22 hs" */
function formatDate(date) {
  const d = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${hh}:${mm} hs`;
}

/** "2026-Apr-16 06:44:03" → "16 abr 2026" */
function formatBuildStamp(stamp) {
  if (!stamp) return null;
  const [year, monthAbbr, day] = stamp.split(' ')[0].split('-');
  const MAP = { Jan:'ene',Feb:'feb',Mar:'mar',Apr:'abr',May:'may',Jun:'jun',
                Jul:'jul',Aug:'ago',Sep:'sep',Oct:'oct',Nov:'nov',Dec:'dic' };
  const month = MAP[monthAbbr] ?? monthAbbr?.toLowerCase() ?? '?';
  return `${parseInt(day, 10)} ${month} ${year}`;
}

function fmtNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function deltaSign(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Genera el texto mrkdwn para un bloque de cambio. */
function formatChangeText(changeEv, diffEv) {
  const data  = parseChangeSummary(changeEv.message);
  const lines = [];

  // Título: script + fecha/hora
  lines.push(`*\`${changeEv.id}\`*   ${formatDate(changeEv.ts)}`);

  // Versión + bytes
  const vOld   = data.hintsOld?.adzoneVersion ?? data.hintsOld?.commentV;
  const vNew   = data.hintsNew?.adzoneVersion ?? data.hintsNew?.commentV;
  const vPart  = vOld && vNew && vOld !== vNew ? `v${vOld} → *v${vNew}*` : '';
  const bPart  = data.bytesDelta !== undefined
    ? `${deltaSign(data.bytesDelta)} bytes (${fmtNum(data.bytesOld)} → ${fmtNum(data.bytesNew)})`
    : '';
  const meta   = [vPart, bPart].filter(Boolean).join('   ·   ');
  if (meta) lines.push(meta);

  // Build date
  const bsOld  = formatBuildStamp(data.hintsOld?.buildStamp);
  const bsNew  = formatBuildStamp(data.hintsNew?.buildStamp);
  if (bsOld && bsNew && bsOld !== bsNew) {
    lines.push(`Build: \`${bsOld}\` → \`${bsNew}\``);
  }

  // Insights del diff
  if (diffEv) {
    const texts = extractInsights(diffEv.body).map(insightToText).filter(Boolean);
    lines.push(...texts.slice(0, 3));
  }

  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────────

let events = [];
try {
  events = parseLog(readFileSync(logPath, 'utf8'));
} catch (e) {
  console.error('notify-slack: error leyendo changes.log:', e.message);
}

// Eventos recientes: ventana de 35 min (cron cada 30 min + margen)
const now    = Date.now();
const WINDOW = 35 * 60 * 1000;
let recent   = events.filter(e => !isNaN(e.ts) && now - e.ts.getTime() < WINDOW);
if (recent.length === 0) recent = events.slice(-20); // fallback para force_slack_test

const changeEvts  = recent.filter(e => e.type === 'change');
const diffByIdent = Object.fromEntries(
  recent.filter(e => e.type === 'diff').map(e => [e.id, e])
);

const runUrl     = runId ? `${server}/${repo}/actions/runs/${runId}` : '';
const hasErrors  = monitorOutcome === 'failure';
const nChanges   = changeEvts.length;

// ── Blocks ─────────────────────────────────────────────────────────────────────

const blocks = [];

// Encabezado
const headerEmoji = hasErrors ? ':warning:' : ':bell:';
const headerText  = hasErrors
  ? `${headerEmoji} *Adzone Monitor* — errores en la ejecución`
  : nChanges > 0
    ? `${headerEmoji} *Adzone Monitor* — ${nChanges} cambio${nChanges !== 1 ? 's' : ''} detectado${nChanges !== 1 ? 's' : ''}`
    : `${headerEmoji} *Adzone Monitor* — test de notificación`;

blocks.push({ type: 'section', text: { type: 'mrkdwn', text: headerText } });

if (hasErrors) {
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: 'El job terminó con *errores de red o HTTP*. Revisá el log del workflow.' },
  });
}

// Un bloque por cambio detectado
for (let i = 0; i < changeEvts.length; i++) {
  blocks.push({ type: 'divider' });
  const chEv = changeEvts[i];
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: formatChangeText(chEv, diffByIdent[chEv.id]) },
  });
}

// Sin cambios recientes (force_slack_test): mostrar estado actual del snapshot
if (nChanges === 0 && !hasErrors) {
  let snapshot = { urls: {} };
  try { snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')); } catch {}
  const stateLines = Object.values(snapshot.urls ?? {}).map(u => {
    const v     = u.hints?.adzoneVersion ?? u.hints?.commentV ?? '?';
    const build = formatBuildStamp(u.hints?.buildStamp) ?? '?';
    return `• \`${u.id}\`: v${v}  (build ${build})`;
  });
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `_Sin cambios recientes. Estado actual:_\n${stateLines.join('\n') || '_sin datos_'}`,
    },
  });
}

// Footer con link al workflow
if (runUrl) {
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `<${runUrl}|Ver ejecución en GitHub Actions>  ·  \`${repo}\`` },
  });
}

// ── Envío ──────────────────────────────────────────────────────────────────────

const fallback = nChanges > 0
  ? `Adzone Monitor: ${nChanges} cambio(s) en ${repo}`
  : `Adzone Monitor: test de notificación — ${repo}`;

const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: fallback, blocks }),
});

if (!res.ok) {
  console.error('notify-slack: HTTP', res.status, await res.text());
  process.exit(1);
}
console.log(`notify-slack: enviado (${nChanges} cambio(s)).`);
