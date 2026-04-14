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
- Ejecuta el script y, solo si cambió `data/snapshot.json` o `logs/changes.log`, hace **commit y push** con el usuario `github-actions[bot]`.

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

## Próximos pasos (fuera de este MVP)

- Alertas (email, Slack) cuando `changes.log` reciba nuevas líneas.
- Ampliar `config/urls.json` con más paths bajo `/c/*` si hace falta.
