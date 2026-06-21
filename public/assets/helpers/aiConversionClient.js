const AI_CONVERSION_ENDPOINT = '/api/convert/ai';

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

  return {
    status: 'fallback',
    yaml: deterministicYaml,
    warnings: [
      `AI settings are configured for ${ settings.provider }, but ${ AI_CONVERSION_ENDPOINT } is not connected yet.`,
      'The deterministic YAML was returned as the safe fallback.'
    ],
    manualReviewItems: [],
    conversionSummary: {
      provider: settings.provider,
      model: settings.model,
      endpoint: settings.endpoint,
      usedAI: false,
      usedDeterministicFallback: true,
      preparedPayload: payload
    }
  };
}
