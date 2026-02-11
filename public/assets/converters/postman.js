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

function mapRequestItemToStep(item) {
  const request = item.request ?? {};
  const mappedRequest = {
    method: request.method || 'GET',
    url: normalizeURL(getRequestURL(request))
  };

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
  }

  return { request: mappedRequest };
}

function mapItemsToSteps(items = []) {
  const steps = [];

  for (const item of items) {
    if (Array.isArray(item?.item) && item.item.length > 0) {
      steps.push({
        group: {
          name: item.name || 'Folder',
          steps: mapItemsToSteps(item.item)
        }
      });
      continue;
    }

    if (item?.request) {
      steps.push(mapRequestItemToStep(item));
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
        steps: mapItemsToSteps(collection?.item ?? [])
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

  return stringifyYAML(apiScenarioManager);
}
