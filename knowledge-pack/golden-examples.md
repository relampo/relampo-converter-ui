# Golden Examples Pack

These examples are real recorded Relampo YAML files and their correlated outputs.

## Local Example Pairs

- `/Users/delvisecheverria/Downloads/Jun 18, 2026./TUID10.yaml`
- `/Users/delvisecheverria/Downloads/Jun 18, 2026./TUID10.correlated.yaml`
- `/Users/delvisecheverria/Downloads/Jun 18, 2026./TUID11.yaml`
- `/Users/delvisecheverria/Downloads/Jun 18, 2026./TUID11.correlated.yaml`
- `/Users/delvisecheverria/Downloads/Jun 18, 2026./TUID15.yaml`
- `/Users/delvisecheverria/Downloads/Jun 18, 2026./TUID15.correlated.yaml`

## Purpose

Use these as few-shot examples for:

- recorded-to-correlated transformations
- extractor insertion
- variable naming
- target replacement with `{{variable}}`
- redirect and chain behavior
- values that should remain static
- metadata preserved by Relampo

## Extraction Method

For each pair:

1. Compare original vs correlated YAML.
2. List extractors added to each source request.
3. List target fields replaced with variables.
4. Identify variable names and source paths.
5. Identify unchanged values that might look dynamic but were not correlated.
6. Capture any redirect/cookie/session behavior.

## AI Rules

- Golden examples show behavior patterns, not universal schema.
- If golden examples conflict with backend runtime, backend wins.
- Use examples to improve correlation reasoning and variable naming.
