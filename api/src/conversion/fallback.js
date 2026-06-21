export function buildFallbackResponse( {
  deterministicYaml,
  provider,
  model,
  warnings = [],
  reason = 'AI conversion is not connected yet.'
} ) {
  return {
    status: 'fallback',
    yaml: deterministicYaml || '',
    warnings: [
      reason,
      'The deterministic YAML was returned as the safe fallback.',
      ...warnings
    ],
    manual_review_items: [],
    conversion_summary: {
      provider,
      model,
      used_ai: false,
      used_deterministic_fallback: true
    },
    validation_result: null,
    confidence: 0
  };
}
