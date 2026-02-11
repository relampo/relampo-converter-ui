import { stringifyYAML } from './yaml.js';

const DEFAULT_OPTIONS = {
  defaultUsers: 1,
  defaultDuration: '1m',
  defaultRampUp: '0s',
  defaultTimeout: '10s',
  defaultUA: 'Pulse-Test'
};

const CONTROLLER_TAGS = new Set([
  'ThreadGroup',
  'GenericController',
  'TransactionController',
  'SimpleController',
  'LoopController',
  'WhileController',
  'IfController',
  'ForeachController'
]);

function elementChildren(node) {
  if (!node) {
    return [];
  }
  return Array.from(node.children ?? []);
}

function findDirectChild(node, tagName, attrName, attrValue) {
  for (const child of elementChildren(node)) {
    if (child.tagName !== tagName) {
      continue;
    }
    if (!attrName) {
      return child;
    }
    if (child.getAttribute(attrName) === attrValue) {
      return child;
    }
  }
  return null;
}

function getStringProp(node, name) {
  const prop = findDirectChild(node, 'stringProp', 'name', name);
  return prop?.textContent?.trim() ?? '';
}

function getBoolProp(node, name) {
  const prop = findDirectChild(node, 'boolProp', 'name', name);
  return (prop?.textContent?.trim() ?? '').toLowerCase() === 'true';
}

function getElementName(node, fallback) {
  return node?.getAttribute('testname')?.trim() || fallback;
}

function getHashTreePairs(hashTreeNode) {
  const children = elementChildren(hashTreeNode);
  const pairs = [];

  for (let i = 0; i < children.length; i += 1) {
    const element = children[i];
    let hashTree = null;

    if (children[i + 1] && children[i + 1].tagName === 'hashTree') {
      hashTree = children[i + 1];
      i += 1;
    }

    if (element.tagName !== 'hashTree') {
      pairs.push({ element, hashTree });
    }
  }

  return pairs;
}

function parseHeaderManager(headerManager) {
  const headers = {};
  const collection = findDirectChild(headerManager, 'collectionProp', 'name', 'HeaderManager.headers');
  if (!collection) {
    return headers;
  }

  for (const headerElement of elementChildren(collection)) {
    if (headerElement.tagName !== 'elementProp') {
      continue;
    }
    const key = getStringProp(headerElement, 'Header.name');
    const value = getStringProp(headerElement, 'Header.value');
    if (key) {
      headers[key] = value;
    }
  }

  return headers;
}

function extractSamplerDefaults(node) {
  return {
    protocol: getStringProp(node, 'HTTPSampler.protocol'),
    domain: getStringProp(node, 'HTTPSampler.domain'),
    port: getStringProp(node, 'HTTPSampler.port')
  };
}

function mergeSamplerDefaults(baseDefaults, incomingDefaults) {
  return {
    protocol: incomingDefaults.protocol || baseDefaults.protocol || '',
    domain: incomingDefaults.domain || baseDefaults.domain || '',
    port: incomingDefaults.port || baseDefaults.port || ''
  };
}

function buildBaseURL({ protocol, domain, port }) {
  if (!domain) {
    return '';
  }

  const scheme = protocol || 'http';
  let portPart = '';
  if (port) {
    const isDefaultHTTP = scheme === 'http' && port === '80';
    const isDefaultHTTPS = scheme === 'https' && port === '443';
    if (!isDefaultHTTP && !isDefaultHTTPS) {
      portPart = `:${port}`;
    }
  }

  return `${scheme}://${domain}${portPart}`;
}

function extractBaseURLFromPath(rawPath) {
  if (!rawPath) {
    return '';
  }

  try {
    const parsed = new URL(rawPath);
    if (parsed.protocol && parsed.host) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch (_err) {
    // Not an absolute URL.
  }

  return '';
}

function normalizePath(rawPath) {
  if (!rawPath) {
    return '/';
  }

  try {
    const parsed = new URL(rawPath);
    if (parsed.host) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch (_err) {
    // Keep non-absolute path values.
  }

  if (rawPath.startsWith('/')) {
    return rawPath;
  }

  return `/${rawPath}`;
}

function extractSamplerArguments(sampler) {
  const argsRoot = findDirectChild(sampler, 'elementProp', 'name', 'HTTPsampler.Arguments');
  if (!argsRoot) {
    return [];
  }

  const argCollection = findDirectChild(argsRoot, 'collectionProp', 'name', 'Arguments.arguments');
  if (!argCollection) {
    return [];
  }

  const args = [];
  for (const argNode of elementChildren(argCollection)) {
    if (argNode.tagName !== 'elementProp') {
      continue;
    }
    const name = getStringProp(argNode, 'Argument.name');
    const value = getStringProp(argNode, 'Argument.value');
    if (name || value) {
      args.push({ name, value });
    }
  }

  return args;
}

function attachQueryParams(path, args) {
  const namedArgs = args.filter((arg) => arg.name);
  if (namedArgs.length === 0) {
    return path;
  }

  const [beforeHash, hash = ''] = path.split('#');
  const separator = beforeHash.includes('?') ? '&' : '?';
  const params = namedArgs
    .map((arg) => `${encodeURIComponent(arg.name)}=${encodeURIComponent(arg.value ?? '')}`)
    .join('&');
  const rebuilt = `${beforeHash}${separator}${params}`;
  return hash ? `${rebuilt}#${hash}` : rebuilt;
}

function buildBodyFromArgs(args) {
  if (args.length === 0) {
    return '';
  }

  return args
    .filter((arg) => arg.name)
    .map((arg) => `${encodeURIComponent(arg.name)}=${encodeURIComponent(arg.value ?? '')}`)
    .join('&');
}

function findHeadersInHashTree(hashTreeNode) {
  const headers = {};
  for (const pair of getHashTreePairs(hashTreeNode)) {
    if (pair.element.tagName === 'HeaderManager') {
      Object.assign(headers, parseHeaderManager(pair.element));
    }
  }
  return headers;
}

function convertSamplerToStep(sampler, samplerHashTree) {
  const method = (getStringProp(sampler, 'HTTPSampler.method') || 'GET').toUpperCase();
  const args = extractSamplerArguments(sampler);
  const postBodyRaw = getBoolProp(sampler, 'HTTPSampler.postBodyRaw');

  let url = normalizePath(getStringProp(sampler, 'HTTPSampler.path'));
  const methodUsesQuery = ['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(method);
  if (methodUsesQuery && args.length > 0) {
    url = attachQueryParams(url, args);
  }

  const request = {
    method,
    url
  };

  const headers = findHeadersInHashTree(samplerHashTree);
  if (Object.keys(headers).length > 0) {
    request.headers = headers;
  }

  if (!methodUsesQuery && args.length > 0) {
    if (postBodyRaw) {
      request.body = args.map((arg) => arg.value ?? '').join('');
    } else {
      const encoded = buildBodyFromArgs(args);
      if (encoded.length > 0) {
        request.body = encoded;
      }
    }
  }

  return { request };
}

function parseStepsFromHashTree(hashTreeNode, inheritedDefaults) {
  const steps = [];
  let localDefaults = { ...inheritedDefaults };

  for (const pair of getHashTreePairs(hashTreeNode)) {
    const tag = pair.element.tagName;

    if (tag === 'ConfigTestElement') {
      localDefaults = mergeSamplerDefaults(localDefaults, extractSamplerDefaults(pair.element));
      continue;
    }

    if (tag === 'HeaderManager' || tag === 'CookieManager' || tag === 'CacheManager') {
      continue;
    }

    if (tag === 'HTTPSamplerProxy') {
      steps.push(convertSamplerToStep(pair.element, pair.hashTree));
      continue;
    }

    if (CONTROLLER_TAGS.has(tag)) {
      const groupName = getElementName(pair.element, tag);
      const nestedSteps = parseStepsFromHashTree(pair.hashTree, localDefaults);
      if (nestedSteps.length > 0) {
        steps.push({
          group: {
            name: groupName,
            steps: nestedSteps
          }
        });
      }
      continue;
    }

    if (pair.hashTree) {
      steps.push(...parseStepsFromHashTree(pair.hashTree, localDefaults));
    }
  }

  return steps;
}

function findBaseURLInTree(hashTreeNode, inheritedDefaults) {
  let localDefaults = { ...inheritedDefaults };

  for (const pair of getHashTreePairs(hashTreeNode)) {
    if (pair.element.tagName === 'ConfigTestElement') {
      localDefaults = mergeSamplerDefaults(localDefaults, extractSamplerDefaults(pair.element));
      const fromConfig = buildBaseURL(localDefaults);
      if (fromConfig) {
        return fromConfig;
      }
    }

    if (pair.element.tagName === 'HTTPSamplerProxy') {
      const samplerDefaults = mergeSamplerDefaults(localDefaults, extractSamplerDefaults(pair.element));
      const fromSampler = buildBaseURL(samplerDefaults);
      if (fromSampler) {
        return fromSampler;
      }

      const pathURL = extractBaseURLFromPath(getStringProp(pair.element, 'HTTPSampler.path'));
      if (pathURL) {
        return pathURL;
      }
    }

    if (pair.hashTree) {
      const nested = findBaseURLInTree(pair.hashTree, localDefaults);
      if (nested) {
        return nested;
      }
    }
  }

  return '';
}

function extractRootTestPlan(rootHashTree) {
  for (const pair of getHashTreePairs(rootHashTree)) {
    if (pair.element.tagName === 'TestPlan') {
      return { testPlan: pair.element, testPlanTree: pair.hashTree };
    }
  }
  return { testPlan: null, testPlanTree: null };
}

export function convertJMXToPulseYAML(jmxText, customOptions = {}) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is not available in this environment');
  }

  const xml = new DOMParser().parseFromString(jmxText, 'application/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) {
    throw new Error('invalid jmx xml');
  }

  const root = xml.documentElement;
  if (!root || root.tagName !== 'jmeterTestPlan') {
    throw new Error('invalid jmx document: missing jmeterTestPlan root');
  }

  const rootHashTree = findDirectChild(root, 'hashTree');
  if (!rootHashTree) {
    throw new Error('invalid jmx document: missing hashTree');
  }

  const { testPlan, testPlanTree } = extractRootTestPlan(rootHashTree);
  const targetTree = testPlanTree || rootHashTree;
  const options = { ...DEFAULT_OPTIONS, ...customOptions };

  const detectedBaseURL = findBaseURLInTree(targetTree, {});
  const globalHeaders = {
    Accept: 'application/json',
    'User-Agent': options.defaultUA
  };

  const steps = parseStepsFromHashTree(targetTree, {});

  const pulse = {
    test: {
      name: getElementName(testPlan, 'Imported JMX Plan'),
      description: 'Imported from JMX test plan',
      version: '1.0'
    },
    variables: {},
    http_defaults: {
      timeout: options.defaultTimeout,
      headers: globalHeaders
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
        steps
      }
    ],
    metrics: {
      enabled: true
    }
  };

  if (detectedBaseURL) {
    pulse.variables.base_url = detectedBaseURL;
    pulse.http_defaults.base_url = detectedBaseURL;
  }

  return stringifyYAML(pulse);
}
