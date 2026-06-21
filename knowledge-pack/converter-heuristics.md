# Converter Heuristics Pack

Source: `relampo-converter-ui@origin/main`

The current converter provides deterministic parsing and useful heuristics. These are evidence for the AI, not the final authority for YAML syntax.

## Minimum Files

- `public/assets/helpers/conversion.js`
- `public/assets/converters/postman.js`
- `public/assets/converters/jmx.js`
- `public/assets/converters/yaml.js`
- `public/assets/helpers/validation.js`
- `public/assets/app.js`
- `src/pages/index.astro`

## Postman Heuristics To Reuse

- URL and `base_url` detection.
- Collection variables and request variables.
- Folder-to-group conversion.
- `pm.environment.set(...)`
- `pm.collectionVariables.set(...)`
- `pm.variables.set(...)`
- JSON aliases such as `const json = pm.response.json()`.
- Path aliases that point into JSON response data.
- Setter helper functions that eventually call a Postman variable setter.
- Known Postman assertions:
  - status code
  - status in list
  - status not in list
  - body contains
  - body not contains
  - body regex match
  - JSON path equality/property/exists
  - response time max
  - response size
  - header exists/value
- Conversion of remaining script logic into Relampo `spark`.
- TODO/manual-review comments for unsupported Postman API lines or invalid converted JavaScript.
- Categorized limitations for auth, scripts, unsupported assertions, invalid converted scripts, and custom assertions.

## JMX Heuristics To Reuse

- HTTP sampler extraction.
- Header manager mapping.
- User defined variables.
- CSV data set config.
- JSON/regex/XPath extractors.
- Response assertions.
- Timers as `think_time`.
- JSR223/BeanShell pre/post processors as `spark`.
- Basic controllers as Relampo controllers/groups.
- Unsupported element warnings.

## AI Rules

- Use deterministic converter output as the first draft.
- Use converter stats/warnings as prompt evidence.
- Do not preserve converter legacy output when backend has a better canonical form.
- Keep deterministic conversion as fallback.
- AI enhancement should explain what it changed.
