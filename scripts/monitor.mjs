import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const JS_CACHE_DIR = join(ROOT, 'data/js-cache');
// Fix 5: diffs más largos que este umbral se guardan en logs/diffs/ en lugar de inline
const DIFF_FILE_THRESHOLD = 50_000;
// Fix 2: cantidad de ejecuciones consecutivas sin ver un script antes de declararlo desaparecido
const MISS_THRESHOLD = 3;
const verbose = process.argv.includes('--verbose');

const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

function logVerbose(...args) {
  if (verbose) console.log(...args);
}

function loadRawConfig() {
  const p = join(ROOT, 'config/urls.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

function entryFromAbsoluteUrl(absUrl, stripQueryDefault) {
  let u;
  try {
    u = new URL(absUrl);
  } catch {
    return null;
  }
  if (stripQueryDefault) {
    u.search = '';
  }
  const path = u.pathname;
  const base = path.split('/').pop() || path;
  const id = base.replace(/\.js$/i, '') || path;
  return {
    id,
    url: u.toString(),
    stripQuery: stripQueryDefault,
  };
}

function matchesDiscovery(urlObj, d) {
  const host = d.scriptHost.toLowerCase();
  if (urlObj.hostname.toLowerCase() !== host) return false;
  if (d.pathIncludes && !urlObj.pathname.includes(d.pathIncludes)) return false;
  if (d.requireExtension && !urlObj.pathname.endsWith(d.requireExtension)) {
    return false;
  }
  return true;
}

function referencedJsPattern(discovery) {
  const host = discovery.scriptHost.replace(/\./g, '\\.');
  return new RegExp(
    `https://${host}/c/[a-zA-Z0-9._-]+\\.js`,
    'gi'
  );
}

async function expandWithReferencedScripts(seedEntries, discovery) {
  if (discovery.deepScanReferencedScripts === false) {
    return seedEntries;
  }
  const stripQ = discovery.stripQuery !== false;
  const byKey = new Map(seedEntries.map((e) => [normalizeFetchUrl(e), e]));
  const refRe = referencedJsPattern(discovery);

  for (const entry of seedEntries) {
    const url = normalizeFetchUrl(entry);
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'adzone-monitor/1.0 (deep scan; GitHub Actions)',
      },
    });
    if (!res.ok) {
      logVerbose(`deepScan: omito ${url} (HTTP ${res.status})`);
      continue;
    }
    const text = await res.text();
    const re = new RegExp(refRe.source, refRe.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      let abs;
      try {
        abs = new URL(m[0]);
      } catch {
        continue;
      }
      if (stripQ) abs.search = '';
      if (!matchesDiscovery(abs, discovery)) continue;
      const key = abs.toString();
      if (byKey.has(key)) continue;
      const ent = entryFromAbsoluteUrl(key, stripQ);
      if (ent) {
        byKey.set(key, ent);
        logVerbose(`  (referenciado en JS) + ${ent.id} ← ${key}`);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function extractScriptSrcs(html) {
  const out = [];
  let m;
  const re = new RegExp(SCRIPT_SRC_RE.source, SCRIPT_SRC_RE.flags);
  while ((m = re.exec(html)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

// Fix 4: extrae el contenido de <script> sin atributo src
function extractInlineScripts(html) {
  const out = [];
  const re = /<script\b(?![^>]*\bsrc\s*=\s*["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const content = m[1].trim();
    if (content.length > 0) out.push(content);
  }
  return out;
}

async function discoverEntries(discovery) {
  const seen = new Map();
  const stripQ = discovery.stripQuery !== false;
  const pageInlineScripts = new Map(); // Fix 4: pageUrl → string[]

  for (const pageUrl of discovery.pages || []) {
    const res = await fetch(pageUrl, {
      redirect: 'follow',
      headers: {
        Accept:
          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'adzone-monitor/1.0 (discovery; GitHub Actions)',
      },
    });
    if (!res.ok) {
      throw new Error(
        `discovery: ${pageUrl} respondió HTTP ${res.status}`
      );
    }
    const html = await res.text();
    const hrefs = extractScriptSrcs(html);
    logVerbose(`discovery: ${pageUrl} → ${hrefs.length} <script src>`);

    if (discovery.monitorInlineScripts !== false) {
      const allInline = extractInlineScripts(html);
      pageInlineScripts.set(pageUrl, allInline);
      logVerbose(`discovery: ${pageUrl} → ${allInline.length} scripts inline`);
    }

    for (const href of hrefs) {
      let abs;
      try {
        abs = new URL(href, pageUrl);
      } catch {
        continue;
      }
      if (!matchesDiscovery(abs, discovery)) continue;
      if (stripQ) abs.search = '';
      const key = abs.toString();
      if (seen.has(key)) continue;
      const ent = entryFromAbsoluteUrl(key, stripQ);
      if (ent) {
        seen.set(key, ent);
        logVerbose(`  + ${ent.id} ← ${key}`);
      }
    }
  }

  const fromHtml = [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
  const entries = await expandWithReferencedScripts(fromHtml, discovery);
  return { entries, pageInlineScripts };
}

function normalizeStaticEntry(raw) {
  const stripQ = raw.stripQuery !== false;
  const u = stripQ ? raw.url.replace(/\?.*$/, '') : raw.url;
  const id =
    raw.id ||
    (() => {
      try {
        const p = new URL(u).pathname.split('/').pop() || '';
        return p.replace(/\.js$/i, '') || u;
      } catch {
        return u;
      }
    })();
  return { id, url: u, stripQuery: stripQ, type: raw.type || 'js' };
}

async function loadEntries() {
  const cfg = loadRawConfig();

  if (Array.isArray(cfg)) {
    return {
      entries: cfg.map((e) => normalizeStaticEntry(e)),
      pageInlineScripts: new Map(),
    };
  }

  const out = [];
  let pageInlineScripts = new Map();
  if (cfg.discovery) {
    const { entries: discovered, pageInlineScripts: pis } = await discoverEntries(cfg.discovery);
    out.push(...discovered);
    pageInlineScripts = pis;
  }
  for (const s of cfg.staticUrls || []) {
    out.push(normalizeStaticEntry(s));
  }

  const byId = new Map();
  for (const e of out) {
    if (byId.has(e.id)) {
      const prev = byId.get(e.id);
      if (prev.url !== e.url) {
        throw new Error(
          `config: id duplicado "${e.id}" con URLs distintas:\n  ${prev.url}\n  ${e.url}`
        );
      }
      continue;
    }
    byId.set(e.id, e);
  }
  return {
    entries: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    pageInlineScripts,
  };
}

function normalizeFetchUrl(entry) {
  let u = entry.url;
  if (entry.stripQuery) {
    try {
      const parsed = new URL(u);
      parsed.search = '';
      u = parsed.toString();
    } catch {
      /* keep original */
    }
  }
  return u;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function extractHints(text) {
  const head = text.slice(0, 1200);
  const hints = {};
  const fv = head.match(/\/\/\s*v\s+(\d+)/);
  if (fv) hints.commentV = fv[1];
  const av = head.match(/adzone\.version\s*=\s*['`]([^'"]+)['`]/);
  if (av) hints.adzoneVersion = av[1];
  const bd = head.match(
    /\/\/\s*((?:\d{4})-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}[^\n]*)/
  );
  if (bd) hints.buildStamp = bd[1].trim();
  return hints;
}

async function probe(entry) {
  const url = normalizeFetchUrl(entry);
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'adzone-monitor/1.0 (GitHub Actions; static asset check)',
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  return {
    urlFetched: url,
    status: res.status,
    sha256: sha256(buf),
    bytes: buf.length,
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
    hints: extractHints(text),
    body: text,
  };
}

function safeCacheBasename(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function jsCachePath(id) {
  return join(JS_CACHE_DIR, `${safeCacheBasename(id)}.js`);
}

function cacheFilePath(entry) {
  const ext = entry.type === 'ads-txt' ? '.txt' : '.js';
  return join(JS_CACHE_DIR, `${safeCacheBasename(entry.id)}${ext}`);
}

// Fix 4: ruta de cache para script inline por página e índice
function inlineCachePath(pageUrl, index) {
  const safe = pageUrl.replace(/[^a-zA-Z0-9._-]/g, '_');
  return join(JS_CACHE_DIR, `_inline_${safe}_${index}.js`);
}

async function prettifyJs(code) {
  try {
    return await prettier.format(code, {
      parser: 'babel',
      printWidth: 120,
      tabWidth: 2,
      semi: true,
      singleQuote: true,
    });
  } catch {
    return code;
  }
}

async function unifiedDiffText(oldText, newText, entryType = 'js') {
  const pretty = entryType === 'js';
  const [oldPretty, newPretty] = pretty
    ? await Promise.all([prettifyJs(oldText), prettifyJs(newText)])
    : [oldText, newText];
  const dir = mkdtempSync(join(tmpdir(), 'adzone-diff-'));
  const oldP = join(dir, 'old.js');
  const newP = join(dir, 'new.js');
  try {
    writeFileSync(oldP, oldPretty, 'utf8');
    writeFileSync(newP, newPretty, 'utf8');
    try {
      const out = execFileSync('diff', ['-u', oldP, newP], {
        encoding: 'utf8',
        maxBuffer: 12 * 1024 * 1024,
      });
      return out.trimEnd() || null;
    } catch (e) {
      if (e && typeof e.status === 'number') {
        if (e.status === 1 && e.stdout) {
          return String(e.stdout).trimEnd();
        }
        if (e.status === 0) return null;
      }
      return `(diff no disponible: ${e instanceof Error ? e.message : e})`;
    }
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

// Fix 5: diffs grandes van a logs/diffs/<id>-<stamp>.diff; los chicos siguen inline
function appendChangeLogDiffBlock(id, diffText) {
  const logsDir = join(ROOT, 'logs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, 'changes.log');
  const stamp = new Date().toISOString();

  if (diffText.length > DIFF_FILE_THRESHOLD) {
    const diffDir = join(logsDir, 'diffs');
    mkdirSync(diffDir, { recursive: true });
    const safestamp = stamp.replace(/[:.]/g, '-');
    const fname = `${safeCacheBasename(id)}-${safestamp}.diff`;
    writeFileSync(join(diffDir, fname), diffText, 'utf8');
    appendFileSync(
      logPath,
      `[${stamp}] ${id}: diff guardado en logs/diffs/${fname} (${diffText.length} chars)\n`,
      'utf8'
    );
  } else {
    appendFileSync(
      logPath,
      `[${stamp}] ${id}: diff unificado (anterior vs actual, vía \`diff -u\`):\n`,
      'utf8'
    );
    appendFileSync(logPath, `${diffText}\n`, 'utf8');
  }
}

function loadSnapshot() {
  const p = join(ROOT, 'data/snapshot.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveSnapshot(data) {
  const p = join(ROOT, 'data/snapshot.json');
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function appendChangeLog(lines) {
  const dir = join(ROOT, 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const p = join(dir, 'changes.log');
  const stamp = new Date().toISOString();
  for (const line of lines) {
    appendFileSync(p, `[${stamp}] ${line}\n`, 'utf8');
  }
}

function pruneChangeLog() {
  const p = join(ROOT, 'logs', 'changes.log');
  if (!existsSync(p)) return;

  const raw = readFileSync(p, 'utf8');
  const lines = raw.split('\n');

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  let bodyStart = 0;
  while (bodyStart < lines.length && (lines[bodyStart].startsWith('#') || lines[bodyStart].trim() === '')) {
    bodyStart++;
  }
  const headerLines = lines.slice(0, bodyStart);

  const entries = [];
  let current = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('[') && line.includes('] ')) {
      if (current) entries.push(current);
      const m = line.match(/^\[([^\]]+)\]/);
      const ts = m ? new Date(m[1]) : null;
      current = { ts, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push(current);

  const before = entries.length;
  const kept = entries.filter(e => !e.ts || isNaN(e.ts) || e.ts >= cutoff);
  const pruned = before - kept.length;
  if (pruned === 0) return;

  const body = kept.flatMap(e => e.lines).join('\n');
  const output = headerLines.join('\n') + (headerLines.length ? '\n' : '') + body;
  writeFileSync(p, output.endsWith('\n') ? output : output + '\n', 'utf8');
  logVerbose(`pruneChangeLog: eliminadas ${pruned} entrada(s) anteriores al ${cutoff.toISOString().slice(0, 10)}`);
}

function semanticEqual(prev, next) {
  if (!prev) return false;
  return (
    prev.status === next.status &&
    prev.sha256 === next.sha256 &&
    prev.bytes === next.bytes &&
    (prev.etag || null) === (next.etag || null) &&
    (prev.lastModified || null) === (next.lastModified || null) &&
    JSON.stringify(prev.hints || {}) === JSON.stringify(next.hints || {}) &&
    prev.fetchedUrl === next.fetchedUrl
  );
}

function pickStableFields(data, entry) {
  return {
    id: entry.id,
    type: entry.type || 'js',
    configUrl: entry.url,
    fetchedUrl: data.urlFetched,
    status: data.status,
    sha256: data.sha256,
    bytes: data.bytes,
    etag: data.etag,
    lastModified: data.lastModified,
    hints: data.hints,
  };
}

function emptyLabel(v) {
  return v == null || v === '' ? '(vacío)' : v;
}

function diffLines(id, prev, next) {
  if (!prev) {
    return [
      `${id}: primera medición (baseline). status=${next.status} bytes=${next.bytes} sha256=${next.sha256} etag=${emptyLabel(next.etag)} lastModified=${emptyLabel(next.lastModified)} hints=${JSON.stringify(next.hints)}`,
    ];
  }
  const changes = [];
  if (prev.status !== next.status) {
    changes.push(`status ${prev.status} → ${next.status}`);
  }
  if (prev.sha256 !== next.sha256) {
    changes.push(
      `sha256 ${prev.sha256.slice(0, 16)}… → ${next.sha256.slice(0, 16)}…`
    );
  }
  if (prev.bytes !== next.bytes) changes.push(`bytes ${prev.bytes} → ${next.bytes}`);
  if ((prev.etag || '') !== (next.etag || '')) {
    changes.push(`etag ${emptyLabel(prev.etag)} → ${emptyLabel(next.etag)}`);
  }
  if ((prev.lastModified || '') !== (next.lastModified || '')) {
    changes.push(
      `lastModified ${emptyLabel(prev.lastModified)} → ${emptyLabel(next.lastModified)}`
    );
  }
  const ph = JSON.stringify(prev.hints || {});
  const nh = JSON.stringify(next.hints || {});
  if (ph !== nh) changes.push(`hints ${ph} → ${nh}`);
  if (changes.length === 0) return [];
  return [`${id}: ${changes.join(' | ')}`];
}

// Fix 4: compara scripts inline de una página contra el snapshot anterior
async function processInlineScripts(pageUrl, currentContents, prevList, logLines) {
  const currCount = currentContents.length;
  const prevCount = prevList.length;

  if (prevCount === 0 && currCount === 0) {
    return { changed: false, nextList: [] };
  }

  // Primera vez que vemos scripts inline en esta página
  if (prevCount === 0) {
    const nextList = currentContents.map((content, i) => {
      const h = sha256(Buffer.from(content, 'utf8'));
      writeFileSync(inlineCachePath(pageUrl, i), content, 'utf8');
      logLines.push(
        `inline:${pageUrl}[${i}]: primera medición (baseline). bytes=${content.length} sha256=${h}`
      );
      return { sha256: h, bytes: content.length };
    });
    return { changed: true, nextList };
  }

  let changed = false;
  if (prevCount !== currCount) {
    logLines.push(
      `inline:${pageUrl}: cantidad de scripts inline cambió ${prevCount} → ${currCount}`
    );
    changed = true;
  }

  const nextList = [];
  const maxIdx = Math.max(prevCount, currCount);
  for (let i = 0; i < maxIdx; i++) {
    const content = currentContents[i];
    const prev = prevList[i];

    if (content === undefined) {
      logLines.push(`inline:${pageUrl}[${i}]: ya no aparece`);
      changed = true;
      continue;
    }

    const h = sha256(Buffer.from(content, 'utf8'));
    const record = { sha256: h, bytes: content.length };

    if (!prev) {
      writeFileSync(inlineCachePath(pageUrl, i), content, 'utf8');
      logLines.push(
        `inline:${pageUrl}[${i}]: nuevo script inline. bytes=${content.length} sha256=${h}`
      );
      changed = true;
    } else if (prev.sha256 !== h) {
      const cachePath = inlineCachePath(pageUrl, i);
      const previousCached = existsSync(cachePath) ? readFileSync(cachePath, 'utf8') : null;
      if (previousCached !== null && previousCached !== content) {
        const diffText = await unifiedDiffText(previousCached, content);
        if (diffText) appendChangeLogDiffBlock(`inline:${pageUrl}[${i}]`, diffText);
      }
      writeFileSync(cachePath, content, 'utf8');
      logLines.push(
        `inline:${pageUrl}[${i}]: sha256 ${prev.sha256.slice(0, 16)}… → ${h.slice(0, 16)}… | bytes ${prev.bytes} → ${content.length}`
      );
      changed = true;
    } else {
      // Sin cambio, actualizar cache igual para tener la última copia
      writeFileSync(inlineCachePath(pageUrl, i), content, 'utf8');
    }

    nextList.push(record);
  }

  return { changed, nextList };
}

async function main() {
  let entries, pageInlineScripts;
  try {
    ({ entries, pageInlineScripts } = await loadEntries());
  } catch (e) {
    console.error(
      'adzone-monitor:',
      e instanceof Error ? e.message : e
    );
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error(
      'adzone-monitor: no hay URLs que vigilar (discovery vacío y staticUrls vacío)'
    );
    process.exit(1);
  }

  logVerbose(`vigilando ${entries.length} script(s):`, entries.map((e) => e.id));

  const snapshot = loadSnapshot();
  const logLines = [];
  let hadProbeError = false;
  let snapshotDirty = false;

  const currentIds = new Set(entries.map((e) => e.id));
  const nextUrls = {};

  // Fix 2: cargar contadores de misses del snapshot
  const pendingRemoval = { ...(snapshot.pendingRemoval || {}) };
  let pendingRemovalDirty = false;

  mkdirSync(JS_CACHE_DIR, { recursive: true });

  // Fix 2: scripts no encontrados en esta ejecución
  for (const id of Object.keys(snapshot.urls || {})) {
    if (!currentIds.has(id)) {
      const missCount = (pendingRemoval[id] || 0) + 1;
      pendingRemoval[id] = missCount;
      pendingRemovalDirty = true;

      if (missCount >= MISS_THRESHOLD) {
        const prev = snapshot.urls[id];
        snapshotDirty = true;
        logLines.push(
          `${id}: ya no aparece enlazado desde la página (${missCount} ejecuciones consecutivas; última url: ${prev?.fetchedUrl ?? prev?.configUrl ?? '—'})`
        );
        delete pendingRemoval[id];
        // Fix 1: NO borrar el cache — se conserva para poder difear si el script reaparece
      } else {
        // Mantener en snapshot mientras esperamos confirmación
        nextUrls[id] = snapshot.urls[id];
        logVerbose(`${id}: no aparece en esta ejecución (miss ${missCount}/${MISS_THRESHOLD}), esperando confirmación`);
      }
    }
  }

  for (const entry of entries) {
    const id = entry.id;

    // Fix 2: resetear contador si el script reapareció
    if (pendingRemoval[id]) {
      delete pendingRemoval[id];
      pendingRemovalDirty = true;
      logVerbose(`${id}: reapareció, contador de misses reseteado`);
    }

    let data;
    try {
      data = await probe(entry);
    } catch (e) {
      hadProbeError = true;
      logLines.push(`${id}: ERROR fetch ${e instanceof Error ? e.message : e}`);
      continue;
    }

    if (data.status !== 200) {
      hadProbeError = true;
      logLines.push(
        `${id}: ERROR HTTP ${data.status} url=${data.urlFetched}`
      );
      continue;
    }

    const body = data.body;
    const cachePath = cacheFilePath(entry);
    const previousCached = existsSync(cachePath)
      ? readFileSync(cachePath, 'utf8')
      : null;

    const record = pickStableFields(data, entry);
    const prev = snapshot.urls[id];
    if (!semanticEqual(prev, record)) {
      snapshotDirty = true;
      logLines.push(...diffLines(id, prev, record));
      if (previousCached !== null && previousCached !== body && prev != null) {
        const diffText = await unifiedDiffText(previousCached, body, entry.type);
        if (diffText) {
          appendChangeLogDiffBlock(id, diffText);
        }
      }
      nextUrls[id] = record;
    } else {
      nextUrls[id] = prev;
    }

    writeFileSync(cachePath, body, 'utf8');
    logVerbose(id, record);
  }

  // Fix 4: procesar scripts inline de cada página descubierta
  const nextInlineScripts = { ...(snapshot.inlineScripts || {}) };
  for (const [pageUrl, contents] of pageInlineScripts) {
    const prevList = (snapshot.inlineScripts || {})[pageUrl] || [];
    const { changed, nextList } = await processInlineScripts(pageUrl, contents, prevList, logLines);
    if (changed) {
      snapshotDirty = true;
      nextInlineScripts[pageUrl] = nextList;
    }
  }

  if (logLines.length > 0) {
    appendChangeLog(logLines);
  }

  if (snapshotDirty || pendingRemovalDirty) {
    snapshot.urls = nextUrls;
    snapshot.inlineScripts = nextInlineScripts;
    snapshot.pendingRemoval = Object.keys(pendingRemoval).length > 0 ? pendingRemoval : undefined;
    snapshot.schemaVersion = 1;
    snapshot.updatedAt = new Date().toISOString();
    saveSnapshot(snapshot);
  }

  pruneChangeLog();

  if (hadProbeError) {
    console.error('adzone-monitor: terminó con errores de red o HTTP');
    process.exit(1);
  }
  console.log('adzone-monitor: ok');
}

main();
