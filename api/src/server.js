import http from 'node:http';
import { config } from './config.js';
import { handleAIConvert, handleAITest } from './routes/aiConvert.js';
import { rejectIfTooLarge, withTimeout } from './security/limits.js';

function securityHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Origin': config.allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-AI-API-Key',
    'Access-Control-Max-Age': '600'
  };
}

function sendJson( response, statusCode, body ) {
  response.writeHead( statusCode, securityHeaders() );
  response.end( JSON.stringify( body ) );
}

function readJsonBody( request ) {
  return new Promise( ( resolve, reject ) => {
    let bytesRead = 0;
    let raw = '';

    request.setEncoding( 'utf8' );

    request.on( 'data', chunk => {
      bytesRead += Buffer.byteLength( chunk );
      try {
        rejectIfTooLarge( bytesRead );
      } catch ( error ) {
        request.destroy();
        reject( error );
        return;
      }
      raw += chunk;
    } );

    request.on( 'end', () => {
      if ( !raw.trim() ) {
        resolve( {} );
        return;
      }

      try {
        resolve( JSON.parse( raw ) );
      } catch {
        const error = new Error( 'Invalid JSON body.' );
        error.statusCode = 400;
        reject( error );
      }
    } );

    request.on( 'error', reject );
  } );
}

async function routeRequest( request ) {
  const url = new URL( request.url, `http://${ request.headers.host || `${ config.host }:${ config.port }` }` );

  if ( request.method === 'GET' && url.pathname === '/health' ) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        service: 'relampo-ai-converter-api'
      }
    };
  }

  if ( request.method === 'POST' && url.pathname === '/api/convert/ai/test' ) {
    request.body = await readJsonBody( request );
    return handleAITest( request );
  }

  if ( request.method === 'POST' && url.pathname === '/api/convert/ai' ) {
    request.body = await readJsonBody( request );
    return handleAIConvert( request );
  }

  return {
    statusCode: 404,
    body: {
      error: 'Not found.'
    }
  };
}

const server = http.createServer( async ( request, response ) => {
  if ( request.method === 'OPTIONS' ) {
    response.writeHead( 204, securityHeaders() );
    response.end();
    return;
  }

  try {
    const result = await withTimeout( routeRequest( request ) );
    sendJson( response, result.statusCode, result.body );
  } catch ( error ) {
    const statusCode = Number.isInteger( error.statusCode ) ? error.statusCode : 500;
    sendJson( response, statusCode, {
      error: statusCode === 500 ? 'Internal server error.' : error.message
    } );
  }
} );

server.listen( config.port, config.host, () => {
  console.log( `Relampo AI Converter API listening on http://${ config.host }:${ config.port }` );
} );
