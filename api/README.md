# Relampo AI Converter API

Small backend/proxy for AI-assisted conversion.

This service is intentionally separate from the static converter UI. It receives the deterministic YAML draft from the converter, validates the request shape, and returns a normalized conversion response. The first phase does not call an AI provider yet; it returns deterministic fallback responses.

## Commands

```bash
npm start
npm run dev
npm run check
```

Default URL:

```text
http://127.0.0.1:8787
```

## Environment

```text
PORT=8787
HOST=127.0.0.1
ALLOWED_ORIGIN=http://127.0.0.1:4321
MAX_BODY_BYTES=5242880
```

## Endpoints

```text
GET  /health
POST /api/convert/ai/test
POST /api/convert/ai
```

API keys must be sent as a request header, not inside the JSON body:

```text
X-AI-API-Key: user-key
```

or:

```text
Authorization: Bearer user-key
```

The service must not persist API keys, source files, or full prompts.
