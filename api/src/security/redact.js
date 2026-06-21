const SECRET_KEYS = new Set( [
  'api_key',
  'apiKey',
  'authorization',
  'Authorization',
  'x-ai-api-key',
  'X-AI-API-Key'
] );

export function redactValue( value ) {
  if ( typeof value !== 'string' || value.length === 0 ) {
    return value;
  }

  if ( value.length <= 8 ) {
    return '[redacted]';
  }

  return `${ value.slice( 0, 4 ) }...[redacted]...${ value.slice( -4 ) }`;
}

export function redactObject( input ) {
  if ( Array.isArray( input ) ) {
    return input.map( redactObject );
  }

  if ( !input || typeof input !== 'object' ) {
    return input;
  }

  const result = {};
  for ( const [ key, value ] of Object.entries( input ) ) {
    result[ key ] = SECRET_KEYS.has( key ) ? redactValue( value ) : redactObject( value );
  }
  return result;
}
