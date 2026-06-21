# Backend Truth Pack

Source: `relampo-backend@origin/develop`

The backend is the source of truth for YAML syntax, execution semantics, validation, correlation, and Studio debug behavior.

## Minimum Files

Runtime/schema:

- `pkg/runtime/model.go`
- `pkg/runtime/config_view.go`
- `pkg/runtime/request.go`
- `pkg/runtime/exec.go`
- `pkg/runtime/auth.go`
- `pkg/runtime/datasource.go`
- `pkg/runtime/extractors.go`
- `pkg/runtime/assertions.go`
- `pkg/runtime/control_flow.go`
- `pkg/runtime/transaction.go`
- `pkg/runtime/parallel.go`
- `pkg/runtime/one_time.go`
- `pkg/runtime/balanced.go`
- `pkg/runtime/think_time.go`
- `pkg/runtime/sql.go`
- `pkg/runtime/sql_types.go`

Validator:

- `pkg/validator/validator.go`
- `pkg/validator/load_config.go`
- `pkg/validator/validator_stages.go`
- `pkg/validator/validator_balanced_test.go`
- `pkg/validator/validator_intent_test.go`

Correlation:

- `internal/correlate/types.go`
- `internal/correlate/analyzer.go`
- `internal/correlate/apply.go`
- `internal/correlate/parser.go`
- `internal/correlate/html.go`
- `internal/correlate/json_text.go`
- `internal/correlate/xml.go`
- `internal/correlate/path.go`
- `internal/correlate/form.go`
- `internal/correlate/cookie.go`
- `internal/correlate/profile_genexus.go`
- `internal/correlate/profile_sap.go`
- `internal/correlate/profile_generic.go`
- `internal/correlate/varname.go`
- `internal/correlate/varname_refine.go`

Studio/debug:

- `cmd/relampo/studio.go`
- `internal/studio/api.go`
- `internal/studio/runs.go`
- `internal/studio/server.go`
- `pkg/engine/engine_models.go`

Examples and datasets:

- `dataset-test/*.yml`
- `dataset-test/CORRELATION_CLI_TEST_CASES.md`
- `testdata/location-correlation-demo.yaml`
- `testdata/redirect-correlation-fixture.yaml`
- `scenarios/intent_*.yaml`
- `docs/CORRELATION_TESTS.md`
- `docs/CORRELATION_PRUEBAS_FUNCIONALES.md`

## Current Runtime Rules

- Steps support `request`, short HTTP methods, `sql`, `think_time`, `group`, `controller`, `transaction`, `balanced`, `one_time`, `parallel`, `if`, `loop`, `retry`, `assertions`, and step-level `data_source`.
- Request fields include `query_params`, `body_raw`, `request_id`, `chain_id`, `chain_role`, `response`, `response_preview`, redirects, embedded resources, `extractors`, `assertions`, `spark`, `files`, and per-request `data_source`.
- `data_source` can exist at root or step level.
- `data_source.file` can also be supplied as `path`.
- `data_source.variable_names` accepts a comma-separated string or a YAML list.
- `balanced` currently supports runtime `type: total`.
- `balanced.mode` must normalize to `iterations` or `virtual_users`.
- `one_time` must not be treated as a load-bearing child for `balanced`.
- `parallel` requires at least one child step.
- `think_time` emits debug event method `THINK_TIME` with `step_path` when debug trace is enabled.
- `relampo debug` is now an alias of `relampo studio`.
- Studio debug uses `/api/studio/info`, `/api/debug/runs`, and `/api/debug/runs/{id}/events`.
- Studio debug runs use `SingleIteration` and one or two VUs.

## AI Rules

- Generate canonical Relampo YAML, not converter legacy syntax.
- Prefer `extractors` and `assertions` arrays.
- Preserve recorded metadata only when it is meaningful to runtime/debug/review.
- Never guess unsupported fields. Emit warnings instead.
- If backend validator rejects the YAML, the result is not acceptable.
