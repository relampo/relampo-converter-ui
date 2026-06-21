# AI Conversion Flow

The converter should remain the user-facing entry point. The AI layer should complement the deterministic converter without replacing it.

## Recommended Flow

```text
User uploads JMX/Postman
  -> deterministic converter parses and drafts YAML
  -> converter extracts stats/warnings/heuristics
  -> AI enhancement API receives:
       original file metadata
       deterministic YAML draft
       converter stats and warnings
       selected knowledge pack sections
  -> AI returns enhanced Relampo YAML and report
  -> backend validator checks YAML
  -> editor compatibility check runs
  -> UI shows YAML, warnings, validation, and download actions
```

## User Experience

The main converter flow stays unchanged:

```text
Upload JMX/Postman
  -> Convert
  -> Review YAML, warnings, validation, and download actions
```

Do not expose a deterministic/AI mode choice in the primary flow. If AI is configured for the user or tenant, the converter may use it behind the same Convert action. If AI is unavailable or disabled, the deterministic path must keep working as the fallback.

## Backend/API Boundary

Do not call AI models directly from the browser. Use a backend endpoint so API keys and validation logic remain server-side.

BYOK settings and request/response payloads are defined in `ai-settings-contract.md`.

Suggested endpoint:

```text
POST /api/convert/ai
```

Request:

```json
{
  "source_type": "postman|jmx",
  "filename": "collection.json",
  "source_text": "...",
  "deterministic_yaml": "...",
  "converter_report": {}
}
```

Response:

```json
{
  "yaml": "...",
  "warnings": [],
  "manual_review_items": [],
  "conversion_summary": {},
  "validation_result": {},
  "confidence": 0.0
}
```

## First Implementation Phase

1. Keep the current upload and Convert interaction.
2. Keep deterministic conversion as the reliable fallback.
3. Add AI configuration outside the primary conversion flow.
4. Wire the Convert action to call AI only when configuration exists.
5. Validate AI output before showing or downloading it.

## AI Rules

- Preserve working deterministic output where it is already correct.
- Improve correlations, extractors, assertions, auth chains, scripts, and variable handling.
- Do not hide uncertain logic.
- Emit review items for anything inferred or unsupported.
