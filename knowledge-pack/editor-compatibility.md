# Editor Compatibility Pack

Source: `relampo-yml-editor@origin/main`

The editor is not the YAML source of truth, but it defines whether generated YAML is easy to inspect, edit, debug, and round-trip.

## Minimum Files

- `src/types/yaml.ts`
- `src/utils/yamlParser.ts`
- `src/utils/yamlTreeSerializer.ts`
- `src/utils/yamlParserHelpers.ts`
- `src/utils/yamlDragDropRules.ts`
- `src/utils/yamlSemanticValidation.ts`
- `src/utils/balancedController.ts`
- `src/components/yaml-node-details/loadUtils.ts`
- `src/components/yaml-tree-view/nodeFactory.ts`
- `src/utils/debugApi.ts`
- `src/components/debugRequests.ts`
- `src/components/YAMLDebugView.tsx`
- `examples/complete-example.yaml`

## Compatibility Rules

- Generated YAML should parse with `parseYAMLToTree`.
- Generated YAML should serialize with `treeToYAML` without semantic loss.
- `linear` is an editor-internal load type; YAML should use `ramp`.
- `query_params` may be merged into request URLs by the editor.
- `redirect_automatically` and `follow_redirects` must not be emitted redundantly.
- Request-level `follow_redirects` is meaningful when it overrides `http_defaults.follow_redirects`.
- `balanced` children should be load-bearing.
- Direct `balanced` children should avoid `parallel`, `one_time`, and `think_time`.
- `transaction` should not be empty.
- Disabled nodes should remain inspectable but should not be treated as executing load.
- Debug event matching uses request labels, URLs, and `step_path`.

## AI Rules

- Use backend syntax first, editor compatibility second.
- Prefer structures that display cleanly in the editor tree.
- Use canonical names and keep request names meaningful.
- Do not rely on stale editor docs for backend schema.
- Round-trip drift should produce a warning or repair attempt.
