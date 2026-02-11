import { stringifyYAML } from './yaml.js';

const EXTRACT_REGEX =
  /pm\.(environment|collectionVariables)\.set\(\s*"([^"]+)"\s*,\s*pm\.response\.json\(\)\.([a-zA-Z0-9_]+)\s*\)/;

const DEFAULT_OPTIONS = {
  defaultUsers: 1,
  defaultDuration: '1m',
  defaultRampUp: '0s',
  defaultTimeout: '10s',
  defaultUA: 'Relampo-Test'
};

function getRequestURL(request) {
  if (!request || request.url == null) {
    return '';
  }

  if (typeof request.url === 'string') {
    return request.url;
  }

  if (typeof request.url === 'object') {
    if (typeof request.url.raw === 'string' && request.url.raw.length > 0) {
      return request.url.raw;
    }

    let result = '';
    if (typeof request.url.protocol === 'string' && request.url.protocol.length > 0) {
      result = `${request.url.protocol}://`;
    }

    if (Array.isArray(request.url.host)) {
      result += request.url.host.join('.');
    } else if (typeof request.url.host === 'string') {
      result += request.url.host;
    }

    if (Array.isArray(request.url.path) && request.url.path.length > 0) {
      result += `/${request.url.path.join('/')}`;
    } else if (typeof request.url.path === 'string' && request.url.path.length > 0) {
      result += request.url.path.startsWith('/') ? request.url.path : `/${request.url.path}`;
    }

    if (Array.isArray(request.url.query) && request.url.query.length > 0) {
      const params = new URLSearchParams();
      for (const entry of request.url.query) {
        if (!entry || entry.disabled || !entry.key) {
          continue;
        }
        params.append(entry.key, entry.value ?? '');
      }
      const query = params.toString();
      if (query.length > 0) {
        result += `?${query}`;
      }
    }

    return result;
  }

  return '';
}

function normalizeURL(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.host) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch (_err) {
    console.warn(`Warning: failed to parse URL "${raw}", using raw value. Error: ${_err.message || _err}`);
  }
  return raw;
}

function parseExtract(events = []) {
  const extracts = {};

  for (const event of events) {
    if (event?.listen !== 'test' || !event?.script?.exec) {
      continue;
    }

    for (const line of event.script.exec) {
      const matches = EXTRACT_REGEX.exec(line);
      if (!matches || matches.length !== 4) {
        continue;
      }
      const variableName = matches[2];
      const field = matches[3];
      extracts[variableName] = `$.${field}`;
    }
  }

  return Object.keys(extracts).length > 0 ? extracts : null;
}

function mapRequestItemToStep(item, context = {}) {
  const request = item.request ?? {};
  const mappedRequest = {
    method: request.method || 'GET',
    url: normalizeURL(getRequestURL(request))
  };

  // Add request name if present
  if (item.name) {
    mappedRequest.name = item.name;
  }

  const headers = {};
  for (const header of request.header ?? []) {
    if (!header || header.disabled || !header.key) {
      continue;
    }
    headers[header.key] = header.value ?? '';
  }
  if (Object.keys(headers).length > 0) {
    mappedRequest.headers = headers;
  }

  const rawBody = request.body?.raw;
  if (typeof rawBody === 'string' && rawBody.trim().length > 0) {
    mappedRequest.body = rawBody;
  }

  const extract = parseExtract(item.event ?? []);
  if (extract) {
    mappedRequest.extract = extract;
    if (context.stats) {
      context.stats.extractors += Object.keys(extract).length;
    }
  }
  
  // Track unsupported features by category
  if (context.stats) {
    // Auth not supported
    if (request.auth && request.auth.type && request.auth.type !== 'noauth') {
      context.stats.requestsWithAuth = (context.stats.requestsWithAuth || 0) + 1;
    }
    
    // Pre-request scripts not supported
    if (item.event && item.event.some(e => e.listen === 'prerequest' && e.script?.exec?.length > 0)) {
      context.stats.requestsWithPreScripts = (context.stats.requestsWithPreScripts || 0) + 1;
    }
    
    // Complex test scripts
    if (item.event && item.event.some(e => e.listen === 'test' && e.script?.exec?.length > 0)) {
      const testScript = item.event.find(e => e.listen === 'test');
      const hasNonExtractLogic = testScript.script.exec.some(line => 
        !line.match(EXTRACT_REGEX) && line.trim().length > 0 && !line.trim().startsWith('//')
      );
      if (hasNonExtractLogic) {
        context.stats.requestsWithComplexTests = (context.stats.requestsWithComplexTests || 0) + 1;
      }
    }
  }
  
  // Count this request
  if (context.stats) {
    context.stats.requests++;
  }

  return { request: mappedRequest };
}

function mapItemsToSteps(items = [], context = {}) {
  const steps = [];

  for (const item of items) {
    if (Array.isArray(item?.item) && item.item.length > 0) {
      steps.push({
        group: {
          name: item.name || 'Folder',
          steps: mapItemsToSteps(item.item, context)
        }
      });
      if (context.stats) {
        context.stats.folders++;
      }
      continue;
    }

    if (item?.request) {
      steps.push(mapRequestItemToStep(item, context));
    }
  }

  return steps;
}

function detectBaseURL(items = []) {
  for (const item of items) {
    if (Array.isArray(item?.item) && item.item.length > 0) {
      const nested = detectBaseURL(item.item);
      if (nested) {
        return nested;
      }
    }

    if (!item?.request) {
      continue;
    }

    const rawURL = getRequestURL(item.request);
    try {
      const parsed = new URL(rawURL);
      if (parsed.protocol && parsed.host) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch (_err) {
      console.warn(`Warning: failed to parse URL "${rawURL}", skipping. Error: ${_err.message || _err}`);
    }
  }

  return '';
}

export function convertPostmanJSONToPulseYAML(postmanText, customOptions = {}) {
  let collection;
  try {
    collection = JSON.parse(postmanText);
  } catch (err) {
    throw new Error(`invalid postman collection json: ${err.message || err}`);
  }

  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  
  // Create context to track statistics
  const context = {
    stats: {
      requests: 0,
      extractors: 0,
      folders: 0,
      requestsWithAuth: 0,
      requestsWithPreScripts: 0,
      requestsWithComplexTests: 0,
      hasCollectionAuth: false,
      hasCollectionVariables: false
    }
  };
  
  // Check for collection-level auth
  if (collection?.auth && collection.auth.type && collection.auth.type !== 'noauth') {
    context.stats.hasCollectionAuth = true;
  }
  
  // Check for collection-level variables
  if (collection?.variable && collection.variable.length > 0) {
    context.stats.hasCollectionVariables = true;
  }

  const apiScenarioManager = {
    test: {
      name: collection?.info?.name || 'Imported Collection',
      description: 'Imported from Postman collection',
      version: '1.0'
    },
    variables: {},
    http_defaults: {
      timeout: options.defaultTimeout,
      headers: {
        Accept: 'application/json',
        'User-Agent': options.defaultUA
      }
    },
    scenarios: [
      {
        name: 'Imported Scenario',
        load: {
          users: options.defaultUsers,
          duration: options.defaultDuration,
          ramp_up: options.defaultRampUp
        },
        cookies: 'auto',
        steps: mapItemsToSteps(collection?.item ?? [], context)
      }
    ],
    metrics: {
      enabled: true
    }
  };

  const baseURL = detectBaseURL(collection?.item ?? []);
  if (baseURL) {
    apiScenarioManager.variables.base_url = baseURL;
    apiScenarioManager.http_defaults.base_url = baseURL;
  }

  // Generate YAML with header and stats
  const yaml = stringifyYAML(apiScenarioManager);
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
  
  let header = `# ============================================================================
# RELAMPO YAML - CONVERTED FROM POSTMAN COLLECTION
# ============================================================================
# Conversion Date: ${timestamp}
# Collection: ${collection?.info?.name || 'Unnamed'}
#
# CONVERSION STATS:
# - HTTP Requests: ${context.stats.requests}
# - Folders/Groups: ${context.stats.folders}
# - Extractors: ${context.stats.extractors}
`;

  // Add limitations summary (categorized)
  const limitations = [];
  if (context.stats.hasCollectionAuth) {
    limitations.push('Collection-level authentication not supported');
  }
  if (context.stats.hasCollectionVariables) {
    limitations.push('Collection variables not auto-converted');
  }
  if (context.stats.requestsWithAuth > 0) {
    limitations.push(`Authentication for ${context.stats.requestsWithAuth} request${context.stats.requestsWithAuth > 1 ? 's' : ''}`);
  }
  if (context.stats.requestsWithPreScripts > 0) {
    limitations.push(`Pre-request scripts for ${context.stats.requestsWithPreScripts} request${context.stats.requestsWithPreScripts > 1 ? 's' : ''}`);
  }
  if (context.stats.requestsWithComplexTests > 0) {
    limitations.push(`Test scripts for ${context.stats.requestsWithComplexTests} request${context.stats.requestsWithComplexTests > 1 ? 's' : ''}`);
  }
  
  if (limitations.length > 0) {
    header += `#
# LIMITATIONS (not converted):
`;
    for (const limitation of limitations) {
      header += `# - ${limitation}
`;
    }
  }
  
  header += `# ============================================================================\n`;

  return header + yaml;
}
