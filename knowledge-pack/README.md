# AI Conversion Knowledge Pack

This knowledge pack defines the source material and operating rules for AI-assisted conversion from JMeter and Postman files into valid Relampo YAML.

The pack has four layers:

1. Backend Truth Pack
2. Editor Compatibility Pack
3. Converter Heuristics Pack
4. Golden Examples Pack

The backend is the authority for YAML syntax and runtime behavior. The editor defines compatibility and review ergonomics. The current converter provides deterministic extraction heuristics. Golden examples show real recorded-to-correlated transformations.

## Source Revisions

- Backend: `relampo-backend@origin/develop`, refreshed at `fe59204f`
- Editor: `relampo-yml-editor@origin/main`, refreshed at `2ed7b26`
- Converter: `relampo-converter-ui@origin/main`, refreshed at `1dac550`

## Core Rule

The AI must not invent Relampo syntax. When sources disagree, prefer the backend runtime and validator over editor docs or converter output.

## Files

- `backend-truth.md`: runtime/schema/validator/correlation sources.
- `editor-compatibility.md`: editor parser, serializer, hierarchy, debug compatibility.
- `converter-heuristics.md`: deterministic rules already present in the converter.
- `golden-examples.md`: recorded vs correlated examples to use as few-shot behavior.
- `validation-gates.md`: validation steps before a YAML is accepted.
- `ai-conversion-flow.md`: proposed end-to-end AI conversion pipeline.
