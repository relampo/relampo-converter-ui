import { buildFallbackResponse } from './fallback.js';

export function parseJSONContent( content ) {
  if ( typeof content !== 'string' ) {
    return null;
  }

  const trimmed = content.trim();
  const fenced = trimmed.match( /^```(?:json)?\s*([\s\S]*?)\s*```$/i );
  const jsonText = fenced ? fenced[ 1 ].trim() : trimmed;

  try {
    return JSON.parse( jsonText );
  } catch {
    return null;
  }
}

export function normalizeAIResponse( response, fallbackContext ) {
  if ( !response || typeof response !== 'object' || typeof response.yaml !== 'string' ) {
    return buildFallbackResponse( {
      ...fallbackContext,
      reason: 'AI response did not include valid YAML.'
    } );
  }

  return {
    status: 'enhanced',
    yaml: response.yaml,
    warnings: Array.isArray( response.warnings ) ? response.warnings : [],
    manual_review_items: Array.isArray( response.manual_review_items ) ? response.manual_review_items : [],
    conversion_summary: response.conversion_summary || {},
    validation_result: response.validation_result || null,
    confidence: typeof response.confidence === 'number' ? response.confidence : 0
  };
}
