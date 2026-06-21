export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number.parseInt( process.env.PORT || '8787', 10 ),
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:4321',
  maxBodyBytes: Number.parseInt( process.env.MAX_BODY_BYTES || `${ 5 * 1024 * 1024 }`, 10 ),
  requestTimeoutMs: Number.parseInt( process.env.REQUEST_TIMEOUT_MS || '30000', 10 ),
  maxAIInputChars: Number.parseInt( process.env.MAX_AI_INPUT_CHARS || '120000', 10 ),
  maxAIOutputTokens: Number.parseInt( process.env.MAX_AI_OUTPUT_TOKENS || '12000', 10 )
};

export const supportedProviders = new Set( [
  'openai',
  'anthropic',
  'openai_compatible',
  'custom_agent'
] );
