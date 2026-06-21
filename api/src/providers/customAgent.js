export function validateCustomAgentSettings( { endpoint } ) {
  const errors = [];

  if ( !endpoint ) {
    errors.push( 'Endpoint is required.' );
  }

  return errors;
}

export async function convertWithCustomAgent() {
  throw new Error( 'Custom agent provider is not connected yet.' );
}
