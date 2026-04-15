# adzone-monitor

Monitoreo periódico de los JavaScript estáticos de **Adzone** en TN. Ya no hace falta listar a mano cada nombre de archivo: el monitor **descubre** los `<script src="…">` que apuntan al CDN configurado (por defecto `s1.adzonestatic.com` bajo `/c/`), y opcionalmente **escanea el cuerpo** de esos scripts para encontrar URLs adicionales que el supertag carga en un segundo paso.

Compara cada ejecución con el **snapshot anterior** (status, tamaño, `sha256`, `ETag`, `Last-Modified` y pistas de versión en el propio `.js`).

## Configuración (`config/urls.json`)

Objeto con:

| Campo | Descripción |
|--------|-------------|
| `discovery.pages` | Lista de páginas HTML a descargar (p. ej. `https://tn.com.ar/`). |
| `discovery.scriptHost` | Host del CDN (p. ej. `s1.adzonestatic.com`). |
| `discovery.pathIncludes` | Solo rutas que contengan este fragmento (p. ej. `/c/`). |
| `discovery.requireExtension` | Sufijo requerido (p. ej. `.js`). |
| `discovery.deepScanReferencedScripts` | Si es `true` (por defecto), tras los scripts del HTML se leen esos `.js` y se añaden más URLs del mismo host que aparezcan como texto (p. ej. `10003_adzone…`, `10003_fastload`). Poné `false` si solo querés el primer nivel. |
| `discovery.stripQuery` | Si es `false`, se conserva query string; por defecto se **ignora** (cache-bust). |
| `staticUrls` | Lista opcional de `{ "url": "…", "id": "…?", "stripQuery": true }` para scripts que **no** salgan del HTML ni del deep scan. |

Si renombran un archivo en el CDN pero el HTML o el supertag apuntan al nombre nuevo, el inventario se **actualiza solo**; lo que ya no aparezca en el grafo descubierto se registra en el log como *ya no aparece enlazado*.

### Formato antiguo (compat)

Si `urls.json` es un **array** de entradas `{ id, url, stripQuery? }`, se usa solo esa lista, sin discovery.

## Uso local

Requiere Node 20+ (`fetch` nativo).

```bash
node scripts/monitor.mjs
node scripts/monitor.mjs --verbose
```

- Si el contenido semántico no cambia, **no se reescribe** `data/snapshot.json`.
- Si hay error de red, discovery vacío o HTTP ≠ 200 en algún script, el proceso puede salir con código **1**.

## GitHub Actions

El workflow `.github/workflows/monitor.yml`:

- Corre **cada hora** (UTC) y permite ejecución manual.
- Si cambian `data/snapshot.json` o `logs/changes.log`, notifica **Slack** (secret `SLACK_WEBHOOK_URL`) y hace **commit + push**.
- En ejecución manual podés forzar un test de Slack con `force_slack_test=true` (envía mensaje aunque no haya cambios).

### Permisos

En **Settings → Actions → General → Workflow permissions**: **Read and write permissions**.

### Slack

Secret **`SLACK_WEBHOOK_URL`** con la URL del Incoming Webhook. Si no está definido, se omite el envío.

## Próximos pasos (opcional)

- Añadir más entradas en `discovery.pages` (home + plantilla de nota) si el supertag difiere por URL.
- Afinar el mensaje de Slack.
