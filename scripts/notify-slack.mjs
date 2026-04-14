import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
if (!webhookUrl) {
  console.log('notify-slack: SLACK_WEBHOOK_URL no definido; omito envío.');
  process.exit(0);
}

const logPath = process.env.CHANGELOG_PATH || join(ROOT, 'logs/changes.log');
const repo = process.env.GITHUB_REPOSITORY || 'repo/desconocido';
const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
const runId = process.env.GITHUB_RUN_ID || '';
const monitorOutcome = process.env.MONITOR_OUTCOME || 'success';

let tail = '';
try {
  const raw = readFileSync(logPath, 'utf8');
  const lines = raw
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  tail = lines.slice(-15).join('\n');
} catch {
  tail = '(no se pudo leer changes.log)';
}

/* Slack mrkdwn en section: límite ~3000 caracteres */
if (tail.length > 2600) {
  tail = `${tail.slice(0, 2600)}\n… (truncado)`;
}

const runUrl =
  runId && server && repo
    ? `${server}/${repo}/actions/runs/${runId}`
    : '';

const statusLine =
  monitorOutcome === 'failure'
    ? ':warning: El job del monitor terminó con *errores* (revisá el log del workflow).'
    : ':white_check_mark: Monitor finalizó sin errores de ejecución.';

const blocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Adzone monitor* — cambios en \`snapshot\` / \`changes.log\`\n${repo}`,
    },
  },
  {
    type: 'section',
    text: { type: 'mrkdwn', text: statusLine },
  },
];

if (runUrl) {
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `<${runUrl}|Ver ejecución en GitHub Actions>`,
    },
  });
}

blocks.push({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: `*Últimas líneas relevantes* de \`logs/changes.log\`:\n\`\`\`\n${tail}\n\`\`\``,
  },
});

const fallbackText = `Adzone monitor: cambios en ${repo}`;

const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: fallbackText, blocks }),
});

if (!res.ok) {
  const body = await res.text();
  console.error('notify-slack: webhook HTTP', res.status, body);
  process.exit(1);
}

console.log('notify-slack: mensaje enviado.');
