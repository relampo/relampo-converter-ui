# Validation Gates

AI-generated YAML is accepted only after passing validation gates.

## Gate 1: Deterministic Draft

The current converter must produce an initial draft or a structured parse report. If it fails, the error and input metadata should still be available to the AI layer.

## Gate 2: Backend YAML Validation

Run the Relampo backend validator against the generated YAML.

Required outcome:

- valid YAML syntax
- valid Relampo schema
- no fatal semantic errors

## Gate 3: Editor Compatibility

The YAML should parse and serialize through the editor:

- `parseYAMLToTree(yaml)`
- `treeToYAML(tree)`

Significant round-trip drift must become a warning or repair item.

## Gate 4: Manual Review Report

The conversion result must include:

- warnings
- unsupported source features
- inferred behavior
- auth gaps
- script logic requiring review
- low-confidence correlations

## Gate 5: Optional Studio Debug

When available, run a one- or two-VU Studio debug pass to confirm request flow and extracted variables.

## Result Contract

The AI conversion API should return:

- `yaml`
- `warnings`
- `manual_review_items`
- `conversion_summary`
- `validation_result`
- `confidence`
- `source_stats`
