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

export async function convertWithOpenAICompatible() {
  throw new Error( 'OpenAI-compatible provider is not connected yet.' );
}
