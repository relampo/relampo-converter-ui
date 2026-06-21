export function buildAIConversionReport( deterministicYaml, sourceMeta = {} ) {
  const warnings = [];
  const manualReviewItems = [];
  const sourceType = sourceMeta.extension === 'jmx' ? 'JMeter' : 'Postman';

  if ( !deterministicYaml || typeof deterministicYaml !== 'string' ) {
    return {
      yaml: deterministicYaml,
      mode: 'ai-enhanced-preview',
      status: 'not-ready',
      summary: [ 'No deterministic YAML draft was available for AI enhancement.' ],
      warnings: [ 'Run deterministic conversion before AI enhancement.' ],
      manualReviewItems: []
    };
  }

  const limitationMatches = [ ...deterministicYaml.matchAll( /^# - (.+)$/gm ) ]
    .map( match => match[ 1 ].trim() )
    .filter( item =>
      /auth|manual review|unsupported|not supported|removed|invalid|custom/i.test( item )
    );

  warnings.push( 'AI backend is not connected yet; this preview keeps the deterministic YAML unchanged.' );

  if ( limitationMatches.length > 0 ) {
    manualReviewItems.push( ...limitationMatches );
  }

  return {
    yaml: deterministicYaml,
    mode: 'ai-enhanced-preview',
    status: 'preview',
    summary: [
      `${ sourceType } deterministic draft prepared`,
      'Knowledge pack ready for backend AI enhancement',
      'Backend validator and editor round-trip gates pending'
    ],
    warnings,
    manualReviewItems
  };
}
