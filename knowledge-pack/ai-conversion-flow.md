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

## UI Modes

- Deterministic
- AI Enhanced

The deterministic path must keep working if AI is unavailable.

## Backend/API Boundary

Do not call AI models directly from the browser. Use a backend endpoint so API keys and validation logic remain server-side.

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

1. Keep current conversion button.
2. Add an optional `AI Enhanced` mode.
3. Build a local stub for AI response shape.
4. Later wire the stub to a real backend API.

## AI Rules

- Preserve working deterministic output where it is already correct.
- Improve correlations, extractors, assertions, auth chains, scripts, and variable handling.
- Do not hide uncertain logic.
- Emit review items for anything inferred or unsupported.
