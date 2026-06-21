export function validateAnthropicSettings( { endpoint, apiKey, model } ) {
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

export async function convertWithAnthropic() {
  throw new Error( 'Anthropic provider is not connected yet.' );
}
