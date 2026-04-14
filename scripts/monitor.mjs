import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const verbose = process.argv.includes('--verbose');

function logVerbose(...args) {
  if (verbose) console.log(...args);
}

function loadUrls() {
  const p = join(ROOT, 'config/urls.json');
  return JSON.parse(readFileSync(p, 'utf8'));
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
  };
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

async function main() {
  const entries = loadUrls();
  const snapshot = loadSnapshot();
  const logLines = [];
  let hadProbeError = false;
  let snapshotDirty = false;

  const nextUrls = { ...snapshot.urls };

  for (const entry of entries) {
    const id = entry.id;
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

    const record = pickStableFields(data, entry);
    const prev = snapshot.urls[id];
    if (!semanticEqual(prev, record)) {
      snapshotDirty = true;
      logLines.push(...diffLines(id, prev, record));
      nextUrls[id] = record;
    } else {
      nextUrls[id] = prev;
    }
    logVerbose(id, record);
  }

  if (logLines.length > 0) {
    appendChangeLog(logLines);
  }

  if (snapshotDirty) {
    snapshot.urls = nextUrls;
    snapshot.schemaVersion = 1;
    snapshot.updatedAt = new Date().toISOString();
    saveSnapshot(snapshot);
  }

  if (hadProbeError) {
    console.error('adzone-monitor: terminó con errores de red o HTTP');
    process.exit(1);
  }
  console.log('adzone-monitor: ok');
}

main();
