# Edge TTS Cloudflare Worker

Este worker provee Text-to-Speech usando la misma tecnología que Microsoft Edge.

## Deploy

1. Instalar Wrangler (CLI de Cloudflare):
```bash
npm install -g wrangler
```

2. Login en Cloudflare:
```bash
wrangler login
```

3. Deploy:
```bash
cd worker
wrangler deploy
```

4. El worker estará en: `https://vocabulary-tts.<tu-usuario>.workers.dev`

## Uso

```
GET https://vocabulary-tts.<tu-usuario>.workers.dev/tts?text=Hello&voice=en-US-AriaNeural
```

### Parámetros

| Param | Descripción | Default |
|-------|-------------|---------|
| text | Texto a convertir | (requerido) |
| voice | ID de la voz | en-US-AriaNeural |
| rate | Velocidad (-50 a 50) | 0 |
| pitch | Tono (-50 a 50) | 0 |

### Voces disponibles

- `en-US-AriaNeural` (Female, US)
- `en-US-GuyNeural` (Male, US)
- `en-US-JennyNeural` (Female, US)
- `en-US-ChristopherNeural` (Male, US)
- `en-GB-SoniaNeural` (Female, UK)
- `en-GB-RyanNeural` (Male, UK)
- `en-AU-NatashaNeural` (Female, AU)
- `en-AU-WilliamNeural` (Male, AU)

## Health Check

```
GET /health
```

Devuelve lista de voces disponibles.
