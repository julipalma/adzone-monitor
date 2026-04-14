# adzone-monitor

Monitoreo periódico de los JavaScript estáticos de **Adzone** usados en TN (`s1.adzonestatic.com`). Compara cada ejecución con el **snapshot anterior** (status, tamaño, `sha256`, `ETag`, `Last-Modified` y pistas de versión leídas del propio archivo).

## Qué vigila

URLs definidas en `config/urls.json`:

- `10011_tn-2023-01.js` — supertag
- `10003_adzone.25.01.js` — rich media (la petición ignora query string de cache-bust)

Si el contenido semántico no cambia, **no se reescribe** `data/snapshot.json` (evita commits vacíos cada hora).

## Uso local

Requiere Node 20+ (`fetch` nativo).

```bash
node scripts/monitor.mjs
# Opcional:
node scripts/monitor.mjs --verbose
```

- **Primera ejecución:** escribe baseline en `logs/changes.log` y actualiza `data/snapshot.json`.
- **Siguientes:** solo añade al log y actualiza el snapshot cuando cambia algo relevante.
- Si hay error de red o HTTP ≠ 200, el proceso sale con código **1** (útil en CI).

## GitHub Actions

El workflow `.github/workflows/monitor.yml`:

- Corre **cada hora** (`cron: 0 * * * *`, UTC) y permite **ejecución manual** (`workflow_dispatch`).
- Ejecuta el script y, solo si cambió `data/snapshot.json` o `logs/changes.log`, envía un mensaje a **Slack** (si configuraste el webhook) y hace **commit y push** con el usuario `github-actions[bot]`.

### Alertas Slack

1. En Slack: [Crear una Incoming Webhook](https://api.slack.com/messaging/webhooks) para el canal donde quieras recibir los avisos (o usá una app con webhook entrante).
2. En el repo de GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
 - Nombre: `SLACK_WEBHOOK_URL`
   - Valor: la URL completa del webhook (empieza con `https://hooks.slack.com/...`).
3. En la próxima ejecución con **cambios** en snapshot o log, el workflow publicará un mensaje con las últimas líneas de `logs/changes.log` y un enlace al run de Actions.

Si no definís el secret, el paso de Slack se omite sin fallar el job.

### Publicar el repo

1. Creá el repositorio vacío en GitHub.
2. En esta carpeta:

   ```bash
   git init
   git add .
   git commit -m "feat: monitor Adzone estático"
   git remote add origin git@github.com:TU_USUARIO/TU_REPO.git
   git branch -M main
   git push -u origin main
   ```

3. En **Settings → Actions → General → Workflow permissions**, activá **Read and write permissions** para que el token del workflow pueda hacer push.

## Próximos pasos (opcional)

- Ampliar `config/urls.json` con más paths bajo `/c/*` si hace falta.
- Afinar el mensaje de Slack (canal dedicado, menciones `@channel`, etc.).
