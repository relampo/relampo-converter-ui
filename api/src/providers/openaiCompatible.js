import { config } from '../config.js';
import { buildRelampoConversionMessages } from '../conversion/buildPrompt.js';
import { normalizeAIResponse, parseJSONContent } from '../conversion/normalizeResponse.js';

function joinURL( baseURL, path ) {
  return new URL( path.replace( /^\//, '' ), baseURL.endsWith( '/' ) ? baseURL : `${ baseURL }/` ).toString();
}

export function validateOpenAICompatibleSettings( { endpoint, apiKey, model } ) {
  const errors = [];

  if ( !endpoint ) {
    errors.push( 'Endpoint is required.' );
  }
  if ( !apiKey ) {
    errors.push( 'API key is required.' );
  }
  if ( !model ) {
    errors.push( 'Model is required.' );
  }

  return errors;
}

export async function testOpenAICompatibleConnection( { endpoint, apiKey, model } ) {
  const response = await fetch( joinURL( endpoint, '/models' ), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ apiKey }`
    }
  } );

  if ( !response.ok ) {
    return {
      ok: false,
      connected: false,
      message: `Provider rejected connection test with HTTP ${ response.status }.`
    };
  }

  return {
    ok: true,
    connected: true,
    model,
    message: 'Provider connection test succeeded.'
  };
}

export async function convertWithOpenAICompatible( { payload, context } ) {
  const { messages, context: promptContext } = buildRelampoConversionMessages( payload );

  const response = await fetch( joinURL( context.endpoint, '/chat/completions' ), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ context.apiKey }`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify( {
      model: context.model,
      messages,
      response_format: {
        type: 'json_object'
      },
      max_tokens: config.maxAIOutputTokens
    } )
  } );

  if ( !response.ok ) {
    const error = new Error( `Provider conversion request failed with HTTP ${ response.status }.` );
    error.statusCode = response.status;
    throw error;
  }

  const body = await response.json();
  const content = body?.choices?.[ 0 ]?.message?.content;
  const parsed = parseJSONContent( content );
  const normalized = normalizeAIResponse( parsed, {
    deterministicYaml: payload.deterministic_yaml,
    provider: context.provider,
    model: context.model,
    warnings: promptContext.prompt_warnings
  } );

  normalized.warnings = [
    ...promptContext.prompt_warnings,
    ...normalized.warnings
  ];
  normalized.conversion_summary = {
    ...normalized.conversion_summary,
    provider: context.provider,
    model: context.model,
    used_ai: normalized.status === 'enhanced',
    used_deterministic_fallback: normalized.status !== 'enhanced'
  };

  return normalized;
}
