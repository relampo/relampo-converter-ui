# AI Settings Contract

This document defines the minimum BYOK configuration needed for AI-assisted conversion without adding login or accounts to the converter.

## Goal

Keep the user flow simple:

```text
Upload file
  -> Convert
  -> YAML output
```

AI configuration must live outside the primary conversion flow. The user should not choose between deterministic and AI conversion for each file.

## Configuration Model

```json
{
  "enabled": true,
  "provider": "openai|anthropic|openai_compatible|custom_agent",
  "endpoint": "https://api.openai.com/v1",
  "model": "gpt-4.1",
  "api_key": "user-provided-secret",
  "remember_on_device": false
}
```

Field rules:

- `enabled`: AI is used only when this is true and the required fields are present.
- `provider`: selects request/response formatting.
- `endpoint`: required for OpenAI-compatible and custom agent providers; optional default for known providers.
- `model`: required for model providers; optional for custom agent endpoints that choose their own model.
- `api_key`: supplied by the user. Do not log it. Do not store it by default.
- `remember_on_device`: if false, keep the key in memory only for the browser session.

## No-Auth First Phase

The first phase does not require Relampo user accounts or authentication.

Recommended behavior:

```text
No AI settings
  -> deterministic conversion only

AI settings present
  -> deterministic draft
  -> AI enhancement through backend/proxy
  -> validation
  -> final YAML

AI settings fail
  -> deterministic YAML remains available
  -> warning explains AI was unavailable
```

## Secure Handling Rules

- Do not store API keys by default.
- If the user chooses to remember the key, store it only in local browser storage and show a clear warning.
- Never include API keys in logs, analytics, errors, URLs, or exported reports.
- Prefer a backend/proxy endpoint for production calls.
- Send only the data required for conversion.
- Show which provider/model was used in the conversion report.
- Let the user clear AI settings at any time.

## Settings UI Shape

The Settings panel can expose:

```text
AI conversion
  [ ] Enable AI conversion
  Provider
  Endpoint
  Model
  API key
  [ ] Remember on this device
  Test connection
  Clear settings
```

This panel should not appear as a step in the conversion workflow.

## Conversion Request To Backend

```json
{
  "source_type": "postman|jmx",
  "filename": "collection.json",
  "source_text": "...",
  "deterministic_yaml": "...",
  "converter_report": {
    "warnings": [],
    "detected_features": [],
    "unsupported_items": []
  },
  "ai_settings": {
    "provider": "openai",
    "endpoint": "https://api.openai.com/v1",
    "model": "gpt-4.1"
  }
}
```

The API key should be sent securely to the backend/proxy for the request, preferably as a request header rather than inside the JSON body. It must not be returned in responses or persisted by the backend.

## Conversion Response From Backend

```json
{
  "status": "enhanced|fallback|failed",
  "yaml": "...",
  "warnings": [],
  "manual_review_items": [],
  "conversion_summary": {
    "provider": "openai",
    "model": "gpt-4.1",
    "used_ai": true,
    "used_deterministic_fallback": false
  },
  "validation_result": {},
  "confidence": 0.0
}
```

Response rules:

- `enhanced`: AI returned YAML and validation passed.
- `fallback`: AI was unavailable or rejected; deterministic YAML is returned.
- `failed`: neither AI nor deterministic conversion produced usable YAML.
- `warnings` and `manual_review_items` must be visible to the user.

## Custom Agent Endpoint

For enterprise users, `custom_agent` can point to a company-owned migration service.

Expected behavior:

```text
converter backend/proxy
  -> customer agent endpoint
  -> customer model/account/guardrails
  -> Relampo YAML response
```

The converter should treat this like any other provider as long as the response follows the same contract.
