import { config } from '../config.js';

export function rejectIfTooLarge( bytesRead ) {
  if ( bytesRead > config.maxBodyBytes ) {
    const error = new Error( `Request body too large. Max ${ config.maxBodyBytes } bytes.` );
    error.statusCode = 413;
    throw error;
  }
}

export function withTimeout( promise, timeoutMs = config.requestTimeoutMs ) {
  let timeoutId;

  const timeout = new Promise( ( _resolve, reject ) => {
    timeoutId = setTimeout( () => {
      const error = new Error( 'Request timed out.' );
      error.statusCode = 504;
      reject( error );
    }, timeoutMs );
  } );

  return Promise.race( [ promise, timeout ] ).finally( () => clearTimeout( timeoutId ) );
}
