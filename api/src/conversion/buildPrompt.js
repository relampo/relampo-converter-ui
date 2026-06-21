import { config } from '../config.js';

function truncateText( value, maxChars, label, warnings ) {
  const text = typeof value === 'string' ? value : '';
  if ( text.length <= maxChars ) {
    return text;
  }

  warnings.push( `${ label } was truncated to ${ maxChars } characters before AI conversion.` );
  return text.slice( 0, maxChars );
}

export function buildPromptContext( payload ) {
  const warnings = [];
  const sourceBudget = Math.floor( config.maxAIInputChars * 0.45 );
  const yamlBudget = config.maxAIInputChars - sourceBudget;

  return {
    source_type: payload.source_type,
    filename: payload.filename,
    source_text: truncateText( payload.source_text, sourceBudget, 'Source file', warnings ),
    deterministic_yaml: truncateText( payload.deterministic_yaml, yamlBudget, 'Deterministic YAML', warnings ),
    converter_report: payload.converter_report || {},
    prompt_warnings: warnings,
    knowledge_pack: [
      'Use backend runtime and validator as schema truth.',
      'Use converter output as draft evidence, not final truth.',
      'Do not invent Relampo YAML syntax.',
      'Keep valid Relampo YAML syntax over cosmetic changes.',
      'Improve correlations, extractors, variables, assertions, and authentication chains only when evidence exists in the source.',
      'Return warnings for inferred, uncertain, unsupported, or truncated logic.'
    ]
  };
}

export function buildRelampoConversionMessages( payload ) {
  const context = buildPromptContext( payload );

  return {
    context,
    messages: [
      {
        role: 'developer',
        content: [
          'You convert JMeter/Postman scripts into valid Relampo YAML.',
          'You must return only JSON, not markdown.',
          'JSON shape: {"yaml":"...","warnings":[],"manual_review_items":[],"confidence":0.0}.',
          'Do not invent Relampo syntax. If uncertain, keep deterministic YAML and add warnings.',
          'The deterministic YAML is draft evidence, not guaranteed truth.'
        ].join( '\n' )
      },
      {
        role: 'user',
        content: JSON.stringify( context )
      }
    ]
  };
}
