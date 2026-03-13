import { stringifyYAML } from './yaml.js';

const EXTRACT_REGEX =
  /pm\.(environment|collectionVariables|variables)\.set\(\s*["']([^"']+)["']\s*,\s*pm\.response\.json\(\)\.([a-zA-Z0-9_]+)\s*\)/;
const SCRIPT_SET_REGEX =
  /pm\.(environment|collectionVariables|variables)\.set\(\s*["']([^"']+)["']/;
const SCRIPT_SET_CAPTURE_REGEX =
  /pm\.(environment|collectionVariables|variables)\.set\(\s*["']([^"']+)["']\s*,\s*([\s\S]+?)\)\s*;?\s*$/;

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

function normalizeVariableValue(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return JSON.stringify(value);
}

function setVariable(variables, key, value = '') {
  if (!variables || typeof key !== 'string') {
    return;
  }

  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return;
  }

  const normalizedValue = normalizeVariableValue(value);
  if (!(normalizedKey in variables) || variables[normalizedKey] === '' || variables[normalizedKey] == null) {
    variables[normalizedKey] = normalizedValue;
  }
}

function pruneEmptyVariables(variables = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(variables)) {
    if (value == null) {
      continue;
    }
    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function collectTemplateVariables(raw, variables) {
  if (typeof raw !== 'string' || !variables) {
    return;
  }

  const templateRegex = /{{\s*([^}\s]+)\s*}}/g;
  for (const match of raw.matchAll(templateRegex)) {
    setVariable(variables, match[1], '');
  }
}

function collectVariableEntries(entries = [], variables) {
  if (!Array.isArray(entries)) {
    return;
  }

  for (const entry of entries) {
    if (!entry || !entry.key || entry.disabled === true || entry.enabled === false) {
      continue;
    }
    setVariable(variables, entry.key, entry.value ?? '');
  }
}

function collectVariablesFromRequest(request = {}, variables) {
  if (!variables) {
    return;
  }

  collectTemplateVariables(getRequestURL(request), variables);

  for (const header of request.header ?? []) {
    if (!header || header.disabled || !header.key) {
      continue;
    }
    collectTemplateVariables(header.value ?? '', variables);
  }

  const body = request.body ?? {};
  if (typeof body.raw === 'string') {
    collectTemplateVariables(body.raw, variables);
  }

  for (const formItem of body.formdata ?? []) {
    if (!formItem || formItem.disabled || !formItem.key) {
      continue;
    }
    collectTemplateVariables(formItem.value ?? '', variables);
  }

  for (const urlEncodedItem of body.urlencoded ?? []) {
    if (!urlEncodedItem || urlEncodedItem.disabled || !urlEncodedItem.key) {
      continue;
    }
    collectTemplateVariables(urlEncodedItem.value ?? '', variables);
  }

  if (typeof body.file?.src === 'string') {
    collectTemplateVariables(body.file.src, variables);
  }

  if (typeof body.graphql?.query === 'string') {
    collectTemplateVariables(body.graphql.query, variables);
  }
  if (body.graphql?.variables != null) {
    collectTemplateVariables(
      typeof body.graphql.variables === 'string'
        ? body.graphql.variables
        : JSON.stringify(body.graphql.variables),
      variables
    );
  }

  const requestURL = request.url;
  if (typeof requestURL === 'object' && requestURL !== null) {
    for (const queryEntry of requestURL.query ?? []) {
      if (!queryEntry || queryEntry.disabled || !queryEntry.key) {
        continue;
      }
      collectTemplateVariables(queryEntry.value ?? '', variables);
    }
  }

  if (request.auth?.type && Array.isArray(request.auth[request.auth.type])) {
    for (const authEntry of request.auth[request.auth.type]) {
      if (!authEntry || authEntry.disabled === true) {
        continue;
      }
      collectTemplateVariables(authEntry.value ?? '', variables);
    }
  }
}

function collectVariablesFromScriptEvents(events = [], variables) {
  if (!Array.isArray(events) || !variables) {
    return;
  }

  function parseLiteralValue(expression, knownLiterals = {}) {
    if (typeof expression !== 'string') {
      return { known: false, value: '' };
    }

    const trimmed = expression.trim().replace(/;$/, '').trim();
    if (!trimmed) {
      return { known: true, value: '' };
    }

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith('\'') && trimmed.endsWith('\'')) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))
    ) {
      return { known: true, value: trimmed.slice(1, -1) };
    }

    if (/^(true|false)$/i.test(trimmed)) {
      return { known: true, value: trimmed.toLowerCase() === 'true' };
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { known: true, value: Number(trimmed) };
    }

    if (trimmed === 'null') {
      return { known: true, value: '' };
    }

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return { known: true, value: JSON.parse(trimmed) };
      } catch (_err) {
        return { known: false, value: '' };
      }
    }

    const varsGetMatch = trimmed.match(
      /^pm\.(?:environment|collectionVariables|variables)\.get\(\s*["']([^"']+)["']\s*\)$/
    );
    if (varsGetMatch) {
      return { known: true, value: `{{${varsGetMatch[1]}}}` };
    }

    if (/^[A-Za-z_$][\w$]*$/.test(trimmed) && Object.prototype.hasOwnProperty.call(knownLiterals, trimmed)) {
      return { known: true, value: knownLiterals[trimmed] };
    }

    return { known: false, value: '' };
  }

  for (const event of events) {
    if (!event?.script?.exec || !Array.isArray(event.script.exec)) {
      continue;
    }

    const localLiterals = {};
    for (const line of event.script.exec) {
      const literalDeclaration = line.match(
        /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+?)\s*;?\s*$/
      );
      if (literalDeclaration) {
        const name = literalDeclaration[1];
        const literal = parseLiteralValue(literalDeclaration[2], localLiterals);
        if (literal.known) {
          localLiterals[name] = literal.value;
        }
      }

      const matches = SCRIPT_SET_CAPTURE_REGEX.exec(line) || SCRIPT_SET_REGEX.exec(line);
      if (!matches || matches.length < 3) {
        continue;
      }
      const variableName = matches[2];
      if (matches.length >= 4) {
        const literal = parseLiteralValue(matches[3], localLiterals);
        setVariable(variables, variableName, literal.known ? literal.value : '');
        continue;
      }
      setVariable(variables, variableName, '');
    }
  }
}

function convertPostmanRuntimeRefs(code) {
  if (typeof code !== 'string' || !code) {
    return code;
  }

  let converted = code;
  converted = converted.replace(
    /pm\.(environment|collectionVariables|variables)\.get\(\s*["']([^"']+)["']\s*\)/g,
    'vars.get("$2")'
  );
  converted = converted.replace(/pm\.response\.json\(\)/g, 'JSON.parse(response.body)');
  converted = converted.replace(/pm\.response\.text\(\)/g, 'response.body');
  converted = converted.replace(/pm\.response\.code/g, 'response.status');
  converted = converted.replace(/pm\.response\.responseTime/g, 'response.latency_ms');
  converted = converted.replace(/pm\.request\.body\.raw/g, 'request.body');
  converted = converted.replace(/pm\.expect\.fail\(\s*([^)]+?)\s*\)\s*;?/g, 'throw new Error($1);');
  converted = converted.replace(/console\.(?:log|warn|error)\(/g, 'log(');
  return converted;
}

function convertPostmanScriptToRelampo(scriptLines = []) {
  if (!Array.isArray(scriptLines)) {
    return { script: null, removedPmLines: 0, invalidSyntax: false };
  }

  const normalizedLines = scriptLines.filter((line) => typeof line === 'string');
  const merged = normalizedLines.join('\n').trim();
  if (!merged) {
    return { script: null, removedPmLines: 0, invalidSyntax: false };
  }

  const convertedLines = normalizedLines.map((line) => {
    const setMatch = line.match(
      /^(\s*)pm\.(environment|collectionVariables|variables)\.set\(\s*["']([^"']+)["']\s*,\s*(.+)\)\s*;?\s*$/
    );
    if (setMatch) {
      const indent = setMatch[1] ?? '';
      const variableName = setMatch[3];
      const valueExpression = convertPostmanRuntimeRefs(setMatch[4].trim());
      return `${indent}vars.set("${variableName}", ${valueExpression});`;
    }

    return convertPostmanRuntimeRefs(line);
  });

  const sanitizedLines = [];
  let removedPmLines = 0;

  for (const line of convertedLines) {
    if (/\bpm\./.test(line)) {
      removedPmLines += 1;
      continue;
    }
    sanitizedLines.push(line);
  }

  if (removedPmLines > 0) {
    sanitizedLines.unshift(
      `// TODO: ${removedPmLines} Postman API line(s) removed (not supported in Relampo spark).`
    );
  }

  const script = sanitizedLines.join('\n').trim();
  if (script) {
    try {
      // Ensure we don't emit syntactically broken spark blocks after filtering Postman-only lines.
      // eslint-disable-next-line no-new-func
      new Function(script);
    } catch (_err) {
      return {
        script: '// TODO: Converted script requires manual review (unsupported syntax after migration).',
        removedPmLines,
        invalidSyntax: true
      };
    }
  }

  return {
    script: script.trim() || null,
    removedPmLines,
    invalidSyntax: false
  };
}

function parseAssertionValue(rawValue) {
  if (rawValue == null) {
    return '';
  }

  const value = rawValue.trim().replace(/;$/, '').trim();
  if (!value) {
    return '';
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith('\'') && value.endsWith('\'')) ||
    (value.startsWith('`') && value.endsWith('`'))
  ) {
    return value.slice(1, -1);
  }

  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === 'true';
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  const variableLookupConverted = value.replace(
    /pm\.(?:environment|collectionVariables|variables)\.get\(\s*["']([^"']+)["']\s*\)/g,
    '{{$1}}'
  );
  return variableLookupConverted;
}

function normalizeJsonAccessorToPath(accessor) {
  if (typeof accessor !== 'string' || !accessor.trim()) {
    return null;
  }

  let normalized = accessor.trim();
  normalized = normalized.replace(/\[['"]([^'"\\]+)['"]\]/g, '.$1');
  normalized = normalized.replace(/\[(\d+)\]/g, '[$1]');
  if (normalized.startsWith('.')) {
    normalized = normalized.slice(1);
  }

  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(normalized)) {
    return null;
  }

  return `$.${normalized}`;
}

function buildJsonPathFromSource(source, jsonAliases) {
  if (typeof source !== 'string') {
    return null;
  }

  const compact = source.replace(/\s+/g, '');
  if (!compact) {
    return null;
  }

  if (compact.startsWith('pm.response.json()')) {
    const accessor = compact.slice('pm.response.json()'.length);
    if (!accessor) {
      return '$';
    }
    return normalizeJsonAccessorToPath(accessor);
  }

  const aliasMatch = compact.match(/^([A-Za-z_$][\w$]*)([\s\S]*)$/);
  if (!aliasMatch) {
    return null;
  }

  const alias = aliasMatch[1];
  const accessor = aliasMatch[2] || '';
  if (!jsonAliases || !jsonAliases.has(alias)) {
    return null;
  }

  if (!accessor) {
    return '$';
  }

  return normalizeJsonAccessorToPath(accessor);
}

function registerJsonAliasFromLine(line, jsonAliases) {
  if (typeof line !== 'string' || !jsonAliases) {
    return false;
  }

  const match = line.match(
    /^\s*(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*pm\.response\.json\(\)\s*;?\s*$/
  );
  if (match && match[1]) {
    jsonAliases.add(match[1]);
    return true;
  }
  return false;
}

function normalizePropertyPath(rawProperty) {
  if (typeof rawProperty !== 'string') {
    return null;
  }

  const property = rawProperty.trim();
  if (!property) {
    return null;
  }

  if (property.startsWith('$')) {
    return normalizeJsonAccessorToPath(property.replace(/^\$/, ''));
  }

  const accessor = property.startsWith('.') || property.startsWith('[') ? property : `.${property}`;
  return normalizeJsonAccessorToPath(accessor);
}

function combineJsonPaths(basePath, propertyPath) {
  if (!basePath || !propertyPath) {
    return null;
  }

  if (basePath === '$') {
    return propertyPath;
  }

  if (basePath.startsWith('$') && propertyPath.startsWith('$')) {
    return `${basePath}${propertyPath.slice(1)}`;
  }

  return null;
}

function addJsonPathAssertion(assertions, path, value) {
  if (!path) {
    return false;
  }

  if (!assertions.json_path) {
    assertions.json_path = {};
  }

  if (Object.prototype.hasOwnProperty.call(assertions.json_path, path)) {
    return false;
  }

  assertions.json_path[path] = value;
  return true;
}

function addBodyContainsAssertion(assertions, value) {
  if (assertions.body_contains != null || typeof value !== 'string' || value.length === 0) {
    return false;
  }

  assertions.body_contains = value;
  return true;
}

function addBodyNotContainsAssertion(assertions, value) {
  if (assertions.body_not_contains != null || typeof value !== 'string' || value.length === 0) {
    return false;
  }

  assertions.body_not_contains = value;
  return true;
}

function addBodyRegexAssertion(assertions, value) {
  if (assertions.body_matches != null || typeof value !== 'string' || value.length === 0) {
    return false;
  }

  assertions.body_matches = value;
  return true;
}

function parseStatusCodesList(raw) {
  if (typeof raw !== 'string') {
    return [];
  }

  return raw
    .split(',')
    .map((code) => Number(code.trim()))
    .filter((code) => Number.isInteger(code));
}

function addStatusListAssertion(assertions, key, statusCodes) {
  if (!Array.isArray(statusCodes) || statusCodes.length === 0) {
    return false;
  }

  if (!Array.isArray(assertions[key])) {
    assertions[key] = [];
  }

  for (const statusCode of statusCodes) {
    if (!assertions[key].includes(statusCode)) {
      assertions[key].push(statusCode);
    }
  }

  return true;
}

function addHeaderAssertion(assertions, name, value = true) {
  if (typeof name !== 'string') {
    return false;
  }

  const normalizedName = name.trim();
  if (!normalizedName) {
    return false;
  }

  if (!assertions.headers || typeof assertions.headers !== 'object') {
    assertions.headers = {};
  }

  if (Object.prototype.hasOwnProperty.call(assertions.headers, normalizedName)) {
    return false;
  }

  assertions.headers[normalizedName] = value;
  return true;
}

function addResponseTimeMaxAssertion(assertions, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return false;
  }

  if (assertions.response_time_max == null || numeric < assertions.response_time_max) {
    assertions.response_time_max = numeric;
    return true;
  }

  return false;
}

function addResponseSizeAssertion(assertions, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return false;
  }

  if (assertions.response_size == null) {
    assertions.response_size = numeric;
    return true;
  }

  return false;
}

function normalizeAssertionsForRuntime(assertions = {}) {
  const assertionsList = [];

  if (assertions.status != null) {
    assertionsList.push({
      type: 'status',
      value: assertions.status
    });
  }

  if (Array.isArray(assertions.status_in) && assertions.status_in.length > 0) {
    assertionsList.push({
      type: 'status_in',
      value: assertions.status_in.length === 1 ? assertions.status_in[0] : assertions.status_in
    });
  }

  if (Array.isArray(assertions.status_not_in) && assertions.status_not_in.length > 0) {
    assertionsList.push({
      type: 'status_not_in',
      value: assertions.status_not_in.length === 1 ? assertions.status_not_in[0] : assertions.status_not_in
    });
  }

  if (typeof assertions.body_contains === 'string' && assertions.body_contains.length > 0) {
    assertionsList.push({
      type: 'contains',
      value: assertions.body_contains
    });
  }

  if (typeof assertions.body_not_contains === 'string' && assertions.body_not_contains.length > 0) {
    assertionsList.push({
      type: 'not_contains',
      value: assertions.body_not_contains
    });
  }

  if (typeof assertions.body_matches === 'string' && assertions.body_matches.length > 0) {
    assertionsList.push({
      type: 'regex',
      value: assertions.body_matches
    });
  }

  if (assertions.response_time_max != null) {
    assertionsList.push({
      type: 'response_time_max',
      value: assertions.response_time_max
    });
  }

  if (assertions.response_size != null) {
    assertionsList.push({
      type: 'response_size',
      value: assertions.response_size
    });
  }

  if (assertions.json_path && typeof assertions.json_path === 'object') {
    for (const [path, value] of Object.entries(assertions.json_path)) {
      assertionsList.push({
        type: 'jsonpath',
        path,
        value: value === 'exists' ? true : value
      });
    }
  }

  if (assertions.headers && typeof assertions.headers === 'object') {
    for (const [name, value] of Object.entries(assertions.headers)) {
      assertionsList.push({
        type: 'header',
        name,
        value
      });
    }
  }

  return {
    assertionsList: assertionsList.length > 0 ? assertionsList : null,
    count: assertionsList.length,
    customCount: 0
  };
}

function parseAssertionsFromLine(line, assertions, jsonAliases = new Set()) {
  if (typeof line !== 'string') {
    return false;
  }

  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return false;
  }

  let matches = trimmed.match(/pm\.response\.to\.have\.status\(\s*(\d{3})\s*\)/);
  if (matches) {
    if (assertions.status == null) {
      assertions.status = Number(matches[1]);
      return true;
    }
    return false;
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.code\s*\)\.to\.(?:be\.)?(?:eql|equal|equals|eq)\(\s*(\d{3})\s*\)/
  );
  if (matches) {
    if (assertions.status == null) {
      assertions.status = Number(matches[1]);
      return true;
    }
    return false;
  }

  matches = trimmed.match(/pm\.expect\(\s*pm\.response\.code\s*\)\.to\.be\.oneOf\(\s*\[([^\]]+)\]\s*\)/);
  if (matches) {
    return addStatusListAssertion(assertions, 'status_in', parseStatusCodesList(matches[1]));
  }

  matches = trimmed.match(/pm\.expect\(\s*pm\.response\.code\s*\)\.to\.not\.be\.oneOf\(\s*\[([^\]]+)\]\s*\)/);
  if (matches) {
    return addStatusListAssertion(assertions, 'status_not_in', parseStatusCodesList(matches[1]));
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.code\s*\)\.to\.not\.(?:be\.)?(?:eql|equal|equals|eq)\(\s*(\d{3})\s*\)/
  );
  if (matches) {
    return addStatusListAssertion(assertions, 'status_not_in', [Number(matches[1])]);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.text\(\)\s*\)\.to\.(?:include|contain)\(\s*(['"`])([\s\S]*?)\1\s*\)/
  );
  if (matches) {
    return addBodyContainsAssertion(assertions, matches[2]);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.text\(\)\s*\)\.to\.not\.(?:include|contain)\(\s*(['"`])([\s\S]*?)\1\s*\)/
  );
  if (matches) {
    return addBodyNotContainsAssertion(assertions, matches[2]);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.text\(\)\s*\)\.to\.(?:match|matches)\(\s*\/(.+)\/([a-z]*)\s*\)\s*;?$/
  );
  if (matches) {
    const pattern = matches[2] ? `${matches[1]}/${matches[2]}` : matches[1];
    return addBodyRegexAssertion(assertions, pattern);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.text\(\)\s*\)\.to\.(?:match|matches)\(\s*new\s+RegExp\(\s*(['"`])([\s\S]*?)\1\s*\)\s*\)\s*;?$/
  );
  if (matches) {
    return addBodyRegexAssertion(assertions, matches[2]);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*([\s\S]+?)\s*\)\.to\.(?:be\.)?(?:eql|equal|equals|eq)\(\s*(.+?)\s*\)\s*;?$/
  );
  if (matches) {
    const path = buildJsonPathFromSource(matches[1], jsonAliases);
    if (!path || path === '$') {
      return false;
    }
    return addJsonPathAssertion(assertions, path, parseAssertionValue(matches[2]));
  }

  matches = trimmed.match(
    /pm\.expect\(\s*([\s\S]+?)\s*\)\.to\.have\.(?:nested\.)?property\(\s*(['"`])([^'"`]+)\2(?:\s*,\s*(.+?))?\s*\)\s*;?$/
  );
  if (matches) {
    const basePath = buildJsonPathFromSource(matches[1], jsonAliases);
    const propertyPath = normalizePropertyPath(matches[3]);
    const path = combineJsonPaths(basePath, propertyPath);
    if (!path) {
      return false;
    }
    const value = matches[4] != null ? parseAssertionValue(matches[4]) : 'exists';
    return addJsonPathAssertion(assertions, path, value);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*([\s\S]+?)\s*\)\.to\.have\.property\(\s*(['"`])([^'"`]+)\2\s*\)\.that\.(?:equals|equal|eql|eq)\(\s*(.+?)\s*\)\s*;?$/
  );
  if (matches) {
    const basePath = buildJsonPathFromSource(matches[1], jsonAliases);
    const propertyPath = normalizePropertyPath(matches[3]);
    const path = combineJsonPaths(basePath, propertyPath);
    if (!path) {
      return false;
    }
    return addJsonPathAssertion(assertions, path, parseAssertionValue(matches[4]));
  }

  matches = trimmed.match(
    /pm\.expect\(\s*([\s\S]+?)\s*\)\.to\.(?:exist|exists|be\.ok)\s*;?$/
  );
  if (matches) {
    const path = buildJsonPathFromSource(matches[1], jsonAliases);
    if (!path || path === '$') {
      return false;
    }
    return addJsonPathAssertion(assertions, path, true);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*([\s\S]+?)\s*\)\.to\.be\.(true|false|null)\s*;?$/
  );
  if (matches) {
    const path = buildJsonPathFromSource(matches[1], jsonAliases);
    if (!path || path === '$') {
      return false;
    }
    const token = matches[2];
    const value = token === 'true' ? true : token === 'false' ? false : null;
    return addJsonPathAssertion(assertions, path, value);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.responseTime\s*\)\.(?:to|is)\.(?:be\.)?(?:below|lessThan|lte|at\.most)\(\s*(\d+)\s*\)/
  );
  if (matches) {
    return addResponseTimeMaxAssertion(assertions, matches[1]);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.responseSize\s*\)\.to\.(?:be\.)?(?:eql|equal|equals|eq)\(\s*(\d+)\s*\)/
  );
  if (matches) {
    return addResponseSizeAssertion(assertions, matches[1]);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.headers\.has\(\s*(['"`])([^'"`]+)\1\s*\)\s*\)\.to\.(?:be\.)?true/
  );
  if (matches) {
    return addHeaderAssertion(assertions, matches[2], true);
  }

  matches = trimmed.match(
    /pm\.response\.to\.have\.header\(\s*(['"`])([^'"`]+)\1(?:\s*,\s*(['"`])([\s\S]*?)\3)?\s*\)/
  );
  if (matches) {
    return addHeaderAssertion(assertions, matches[2], matches[4] != null ? matches[4] : true);
  }

  matches = trimmed.match(
    /pm\.expect\(\s*pm\.response\.headers\.get\(\s*(['"`])([^'"`]+)\1\s*\)\s*\)\.to\.(?:be\.)?(?:eql|equal|equals|eq)\(\s*(['"`])([\s\S]*?)\3\s*\)/
  );
  if (matches) {
    return addHeaderAssertion(assertions, matches[2], matches[4]);
  }

  return false;
}

function parseScriptArtifacts(events = [], context = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    return { sparkScripts: null, assertionsList: null };
  }

  const sparkScripts = [];
  const assertions = {};
  const jsonAliases = new Set();

  for (const event of events) {
    if (!event?.script?.exec || !Array.isArray(event.script.exec)) {
      continue;
    }

    const isPreRequest = event.listen === 'prerequest';
    const isPostResponse = event.listen === 'test';
    if (!isPreRequest && !isPostResponse) {
      continue;
    }

    const lines = event.script.exec.filter((line) => typeof line === 'string');
    const remainingLines = [];
    let unsupportedExpectCount = 0;

    let insidePmTestWrapper = false;
    let pendingExpectLines = null;

    for (const line of lines) {
      if (isPostResponse && pendingExpectLines) {
        pendingExpectLines.push(line);
        if (/;\s*$/.test(line.trim())) {
          const mergedExpect = pendingExpectLines.join(' ').trim();
          pendingExpectLines = null;
          if (!parseAssertionsFromLine(mergedExpect, assertions, jsonAliases)) {
            unsupportedExpectCount += 1;
          }
        }
        continue;
      }

      const isJsonAliasLine = isPostResponse ? registerJsonAliasFromLine(line, jsonAliases) : false;

      if (isPostResponse) {
        if (isJsonAliasLine) {
          // Alias helpers like `const json = pm.response.json();` are only scaffolding for assertions.
          continue;
        }
      }

      if (isPostResponse && /^\s*pm\.test\(/.test(line)) {
        insidePmTestWrapper = true;
        continue;
      }

      if (isPostResponse && EXTRACT_REGEX.test(line)) {
        continue;
      }

      if (isPostResponse && /pm\.expect\(/.test(line) && !/;\s*$/.test(line.trim())) {
        pendingExpectLines = [line];
        continue;
      }

      if (isPostResponse && parseAssertionsFromLine(line, assertions, jsonAliases)) {
        continue;
      }

      if (isPostResponse && /pm\.expect\(|pm\.response\.to\.have\.status\(/.test(line)) {
        unsupportedExpectCount += 1;
        continue;
      }

      if (isPostResponse && insidePmTestWrapper && /^\s*\}\)\s*;?\s*$/.test(line)) {
        insidePmTestWrapper = false;
        continue;
      }

      remainingLines.push(line);
    }

    if (isPostResponse && pendingExpectLines && pendingExpectLines.length > 0) {
      const mergedExpect = pendingExpectLines.join(' ').trim();
      if (!parseAssertionsFromLine(mergedExpect, assertions, jsonAliases)) {
        unsupportedExpectCount += 1;
      }
    }

    if (isPostResponse && unsupportedExpectCount > 0) {
      remainingLines.push(
        `// TODO: ${unsupportedExpectCount} unsupported Postman assertion pattern(s). Convert manually.`
      );
      if (context.stats) {
        context.stats.scriptsNeedManualReview += unsupportedExpectCount;
      }
    }

    const convertedScriptResult = convertPostmanScriptToRelampo(remainingLines);
    if (!convertedScriptResult.script) {
      continue;
    }

    const sparkEntry = {
      name: isPreRequest ? 'Pre-request Script' : 'Post-response Script',
      when: isPreRequest ? 'before' : 'after',
      script: convertedScriptResult.script
    };
    sparkScripts.push(sparkEntry);

    if (context.stats) {
      context.stats.sparkScripts += 1;
      context.stats.scriptsNeedManualReview += convertedScriptResult.removedPmLines || 0;
      if (convertedScriptResult.invalidSyntax) {
        context.stats.scriptsNeedManualReview += 1;
      }
    }
  }

  const normalizedAssertions = normalizeAssertionsForRuntime(assertions);
  if (context.stats && normalizedAssertions.count > 0) {
    context.stats.assertions += normalizedAssertions.count;
    context.stats.customAssertions += normalizedAssertions.customCount || 0;
  }

  return {
    sparkScripts: sparkScripts.length > 0 ? sparkScripts : null,
    assertionsList: normalizedAssertions.assertionsList
  };
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

  if (context.variables) {
    collectVariablesFromRequest(request, context.variables);
    collectVariablesFromScriptEvents(item.event ?? [], context.variables);
    collectVariableEntries(item.variable ?? [], context.variables);
  }

  const extract = parseExtract(item.event ?? []);
  if (extract) {
    mappedRequest.extract = extract;
    if (context.stats) {
      context.stats.extractors += Object.keys(extract).length;
    }
    if (context.variables) {
      for (const variableName of Object.keys(extract)) {
        setVariable(context.variables, variableName, context.variables[variableName] ?? '');
      }
    }
  }

  const { sparkScripts, assertionsList } = parseScriptArtifacts(item.event ?? [], context);
  if (sparkScripts) {
    mappedRequest.spark = sparkScripts;
  }
  if (assertionsList) {
    mappedRequest.assertions = assertionsList;
  }

  // Track unsupported features by category
  if (context.stats) {
    if (request.auth && request.auth.type && request.auth.type !== 'noauth') {
      context.stats.requestsWithAuth = (context.stats.requestsWithAuth || 0) + 1;
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
    if (context.variables) {
      collectVariableEntries(item?.variable ?? [], context.variables);
    }

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
    variables: {},
    stats: {
      requests: 0,
      extractors: 0,
      assertions: 0,
      customAssertions: 0,
      folders: 0,
      sparkScripts: 0,
      variables: 0,
      requestsWithAuth: 0,
      scriptsNeedManualReview: 0,
      hasCollectionAuth: false,
    }
  };

  // Check for collection-level auth
  if (collection?.auth && collection.auth.type && collection.auth.type !== 'noauth') {
    context.stats.hasCollectionAuth = true;
  }

  collectVariableEntries(collection?.variable ?? [], context.variables);
  collectVariableEntries(collection?.values ?? [], context.variables);

  const apiScenarioManager = {
    test: {
      name: collection?.info?.name || 'Imported Collection',
      description: 'Imported from Postman collection',
      version: '1.0'
    },
    variables: context.variables,
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
        steps: mapItemsToSteps(collection?.item ?? [], context)
      }
    ]
  };

  const baseURL = detectBaseURL(collection?.item ?? []);
  if (baseURL) {
    setVariable(apiScenarioManager.variables, 'base_url', baseURL);
    apiScenarioManager.http_defaults.base_url = baseURL;
  }

  const cleanedVariables = pruneEmptyVariables(apiScenarioManager.variables);
  context.stats.variables = Object.keys(cleanedVariables).length;
  if (context.stats.variables > 0) {
    apiScenarioManager.variables = cleanedVariables;
  } else {
    delete apiScenarioManager.variables;
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
# - Assertions: ${context.stats.assertions}
# - Custom Assertions: ${context.stats.customAssertions}
# - Spark Scripts: ${context.stats.sparkScripts}
# - User Variables: ${context.stats.variables}
`;

  // Add limitations summary (categorized)
  const limitations = [];
  if (context.stats.hasCollectionAuth) {
    limitations.push('Collection-level authentication not supported');
  }
  if (context.stats.requestsWithAuth > 0) {
    limitations.push(`Authentication for ${context.stats.requestsWithAuth} request${context.stats.requestsWithAuth > 1 ? 's' : ''}`);
  }
  if (context.stats.scriptsNeedManualReview > 0) {
    limitations.push(
      `Postman script APIs in ${context.stats.scriptsNeedManualReview} script${context.stats.scriptsNeedManualReview > 1 ? 's may' : ' may'} require manual adjustment`
    );
  }
  if (context.stats.customAssertions > 0) {
    limitations.push(
      `${context.stats.customAssertions} pm.expect assertion${context.stats.customAssertions > 1 ? 's' : ''} mapped as custom and may require manual adjustment`
    );
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
