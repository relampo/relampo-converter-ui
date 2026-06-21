export function buildPromptContext( payload ) {
  return {
    source_type: payload.source_type,
    filename: payload.filename,
    deterministic_yaml: payload.deterministic_yaml,
    converter_report: payload.converter_report,
    knowledge_pack: [
      'Use backend runtime and validator as schema truth.',
      'Use converter output as draft evidence, not final truth.',
      'Do not invent Relampo YAML syntax.',
      'Return warnings for inferred or uncertain logic.'
    ]
  };
}
