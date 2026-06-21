import { supportedProviders } from '../config.js';
import { buildFallbackResponse } from '../conversion/fallback.js';
import { validateAnthropicSettings } from '../providers/anthropic.js';
import { validateCustomAgentSettings } from '../providers/customAgent.js';
import { validateOpenAICompatibleSettings } from '../providers/openaiCompatible.js';

function getAIKey( request ) {
  const headerKey = request.headers[ 'x-ai-api-key' ];
  const authorization = request.headers.authorization;

  if ( typeof headerKey === 'string' && headerKey.trim() ) {
    return headerKey.trim();
  }

  if ( typeof authorization === 'string' && authorization.startsWith( 'Bearer ' ) ) {
    return authorization.slice( 7 ).trim();
  }

  return '';
}

function validatePayloadBase( body ) {
  const errors = [];

  if ( !body || typeof body !== 'object' ) {
    return [ 'JSON body is required.' ];
  }
  if ( body.ai_settings?.api_key || body.ai_settings?.apiKey ) {
    errors.push( 'API key must be sent as a header, not in the JSON body.' );
  }
  if ( ![ 'postman', 'jmx' ].includes( body.source_type ) ) {
    errors.push( 'source_type must be postman or jmx.' );
  }
  if ( typeof body.filename !== 'string' || !body.filename.trim() ) {
    errors.push( 'filename is required.' );
  }
  if ( typeof body.deterministic_yaml !== 'string' || !body.deterministic_yaml.trim() ) {
    errors.push( 'deterministic_yaml is required.' );
  }
  if ( typeof body.source_text !== 'string' ) {
    errors.push( 'source_text is required.' );
  }

  return errors;
}

function validateProviderSettings( body, apiKey ) {
  const settings = body.ai_settings || {};
  const provider = settings.provider || '';

  if ( !supportedProviders.has( provider ) ) {
    return {
      provider,
      errors: [ 'Unsupported provider.' ]
    };
  }

  const context = {
    endpoint: typeof settings.endpoint === 'string' ? settings.endpoint.trim() : '',
    model: typeof settings.model === 'string' ? settings.model.trim() : '',
    apiKey
  };

  if ( provider === 'anthropic' ) {
    return { provider, context, errors: validateAnthropicSettings( context ) };
  }

  if ( provider === 'custom_agent' ) {
    return { provider, context, errors: validateCustomAgentSettings( context ) };
  }

  return { provider, context, errors: validateOpenAICompatibleSettings( context ) };
}

export async function handleAITest( request ) {
  const apiKey = getAIKey( request );
  const baseErrors = validatePayloadBase( {
    ...request.body,
    source_type: request.body?.source_type || 'postman',
    filename: request.body?.filename || 'connection-test.json',
    source_text: request.body?.source_text || '',
    deterministic_yaml: request.body?.deterministic_yaml || 'test:\n  name: Connection Test\n'
  } );
  const { provider, context, errors: providerErrors } = validateProviderSettings( request.body || {}, apiKey );
  const errors = [ ...baseErrors, ...providerErrors ];

  if ( errors.length > 0 ) {
    return {
      statusCode: 400,
      body: {
        ok: false,
        provider,
        errors
      }
    };
  }

  return {
    statusCode: 200,
    body: {
      ok: true,
      provider,
      model: context.model,
      connected: false,
      message: 'Settings are valid. Provider calls are not connected yet.'
    }
  };
}

export async function handleAIConvert( request ) {
  const body = request.body;
  const apiKey = getAIKey( request );
  const baseErrors = validatePayloadBase( body );
  const { provider, context, errors: providerErrors } = validateProviderSettings( body || {}, apiKey );
  const errors = [ ...baseErrors, ...providerErrors ];

  if ( errors.length > 0 ) {
    return {
      statusCode: 400,
      body: {
        status: 'failed',
        yaml: body?.deterministic_yaml || '',
        warnings: errors,
        manual_review_items: [],
        conversion_summary: {
          provider,
          model: context?.model,
          used_ai: false,
          used_deterministic_fallback: false
        },
        validation_result: null,
        confidence: 0
      }
    };
  }

  return {
    statusCode: 200,
    body: buildFallbackResponse( {
      deterministicYaml: body.deterministic_yaml,
      provider,
      model: context.model,
      reason: 'AI provider calls are not connected yet.'
    } )
  };
}
