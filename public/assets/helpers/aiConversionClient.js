const DEFAULT_AI_PROXY_URL = 'http://127.0.0.1:8787';

function buildProxyURL( settings, path ) {
  const baseURL = settings.proxyUrl || DEFAULT_AI_PROXY_URL;
  return new URL( path, baseURL.endsWith( '/' ) ? baseURL : `${ baseURL }/` ).toString();
}

function buildHeaders( settings ) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if ( settings.apiKey ) {
    headers[ 'X-AI-API-Key' ] = settings.apiKey;
  }

  return headers;
}

async function readProxyJSON( response ) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if ( !response.ok ) {
    const error = new Error( body?.error || body?.warnings?.join( ' ' ) || body?.errors?.join( ' ' ) || 'AI proxy request failed.' );
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export function getAISettingsStatus( settings ) {
  if ( !settings?.enabled ) {
    return {
      ready: false,
      reason: 'AI conversion is disabled.'
    };
  }

  if ( !settings.endpoint ) {
    return {
      ready: false,
      reason: 'AI endpoint is required.'
    };
  }

  if ( settings.provider !== 'custom_agent' && !settings.apiKey ) {
    return {
      ready: false,
      reason: 'API key is required for this provider.'
    };
  }

  return {
    ready: true,
    reason: null
  };
}

export async function testAIConnection( settings ) {
  const status = getAISettingsStatus( settings );
  if ( !status.ready ) {
    throw new Error( status.reason );
  }

  const response = await fetch( buildProxyURL( settings, '/api/convert/ai/test' ), {
    method: 'POST',
    headers: buildHeaders( settings ),
    body: JSON.stringify( {
      ai_settings: {
        provider: settings.provider,
        endpoint: settings.endpoint,
        model: settings.model
      }
    } )
  } );

  return readProxyJSON( response );
}

export function buildAIConversionPayload( {
  sourceType,
  filename,
  sourceText,
  deterministicYaml,
  converterReport,
  settings
} ) {
  return {
    source_type: sourceType,
    filename,
    source_text: sourceText,
    deterministic_yaml: deterministicYaml,
    converter_report: converterReport,
    ai_settings: {
      provider: settings.provider,
      endpoint: settings.endpoint,
      model: settings.model
    }
  };
}

export async function convertWithAIEnhancement( {
  sourceType,
  filename,
  sourceText,
  deterministicYaml,
  converterReport,
  settings
} ) {
  const status = getAISettingsStatus( settings );

  if ( !status.ready ) {
    return {
      status: 'fallback',
      yaml: deterministicYaml,
      warnings: [ status.reason ],
      manualReviewItems: [],
      conversionSummary: {
        usedAI: false,
        usedDeterministicFallback: true
      }
    };
  }

  const payload = buildAIConversionPayload( {
    sourceType,
    filename,
    sourceText,
    deterministicYaml,
    converterReport,
    settings
  } );

  try {
    const response = await fetch( buildProxyURL( settings, '/api/convert/ai' ), {
      method: 'POST',
      headers: buildHeaders( settings ),
      body: JSON.stringify( payload )
    } );
    const body = await readProxyJSON( response );

    return {
      status: body.status,
      yaml: body.yaml || deterministicYaml,
      warnings: Array.isArray( body.warnings ) ? body.warnings : [],
      manualReviewItems: Array.isArray( body.manual_review_items ) ? body.manual_review_items : [],
      conversionSummary: body.conversion_summary || {}
    };
  } catch ( err ) {
    return {
      status: 'fallback',
      yaml: deterministicYaml,
      warnings: [
        `AI proxy request failed: ${ err.message || err }`,
        'The deterministic YAML was returned as the safe fallback.'
      ],
      manualReviewItems: [],
      conversionSummary: {
        provider: settings.provider,
        model: settings.model,
        endpoint: settings.endpoint,
        proxyUrl: settings.proxyUrl,
        usedAI: false,
        usedDeterministicFallback: true
      }
    };
  }
}
