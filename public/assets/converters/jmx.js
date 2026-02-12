import { stringifyYAML } from './yaml.js';

const DEFAULT_OPTIONS = {
  defaultUsers: 1,
  defaultDuration: '1m',
  defaultRampUp: '0s',
  defaultTimeout: '10s',
  defaultUA: 'Pulse-Test'
};

const CONTROLLER_TAGS = new Set([
  'GenericController',
  'TransactionController',
  'SimpleController'
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

function parseUserDefinedVariables(argumentsNode) {
  const variables = {};
  const collection = findDirectChild(argumentsNode, 'collectionProp', 'name', 'Arguments.arguments');
  if (!collection) {
    return variables;
  }

  for (const argElement of elementChildren(collection)) {
    if (argElement.tagName !== 'elementProp') {
      continue;
    }
    const name = getStringProp(argElement, 'Argument.name');
    const value = getStringProp(argElement, 'Argument.value');
    if (name) {
      variables[name] = value;
    }
  }

  return variables;
}

function parseCSVDataSet(csvNode) {
  const filename = getStringProp(csvNode, 'filename');
  const variableNames = getStringProp(csvNode, 'variableNames');
  const shareMode = getStringProp(csvNode, 'shareMode');
  const recycle = getBoolProp(csvNode, 'recycle');
  const stopThread = getBoolProp(csvNode, 'stopThread');

  // Include even if filename is empty
  const dataSource = {
    type: 'csv',
    file: filename || 'INCOMPLETE',
    mode: shareMode === 'shareMode.all' ? 'shared' : 'per_vu',
    strategy: 'sequential',
    on_exhausted: stopThread ? 'stop' : 'recycle'
  };

  // Parse variable names
  if (variableNames) {
    const varList = variableNames.split(',').map(v => v.trim()).filter(v => v);
    if (varList.length > 0) {
      dataSource.bind = {};
      for (const varName of varList) {
        dataSource.bind[varName] = varName;
      }
    }
  } else {
    // Add placeholder if empty
    dataSource.bind = { INCOMPLETE: 'INCOMPLETE' };
  }

  return dataSource;
}

function convertJMeterVarToRelampo(str) {
  if (!str) return str;
  // ${var} → {{var}}
  return str.replace(/\$\{([^}]+)\}/g, '{{$1}}');
}

function parseExtractors(hashTreeNode, context) {
  if (!hashTreeNode) return null;
  
  const extractors = [];
  
  // Recursively search for extractors
  function findExtractors(node) {
    if (!node) return;
    
    for (const child of elementChildren(node)) {
      const tag = child.tagName;
      const elementName = getElementName(child, tag);

      // JSON Extractor
      if (tag === 'JSONPostProcessor') {
        const refName = getStringProp(child, 'JSONPostProcessor.referenceNames');
        const jsonPath = getStringProp(child, 'JSONPostProcessor.jsonPathExprs');
        const defaultValue = getStringProp(child, 'JSONPostProcessor.defaultValues');
        
        if (!jsonPath) continue; // Skip if no path
        
        const extractor = {
          type: 'jsonpath',
          var: refName || 'INCOMPLETE',
          path: jsonPath
        };
        
        if (defaultValue) {
          extractor.default = defaultValue;
        }
        
        extractors.push(extractor);
      }

      // Regex Extractor
      else if (tag === 'RegexExtractor') {
        const refName = getStringProp(child, 'RegexExtractor.refname');
        const regex = getStringProp(child, 'RegexExtractor.regex');
        const defaultValue = getStringProp(child, 'RegexExtractor.default');
        const template = getStringProp(child, 'RegexExtractor.template');
        const matchNo = getStringProp(child, 'RegexExtractor.match_number');
        
        if (!regex) continue; // Skip if no pattern
        
        const extractor = {
          type: 'regex',
          var: refName || 'INCOMPLETE',
          pattern: regex
        };
        
        if (defaultValue) {
          extractor.default = defaultValue;
        }
        if (matchNo && matchNo !== '1' && matchNo !== '0') {
          extractor.match_no = matchNo;
        }
        if (template && template !== '$1$' && template !== '') {
          extractor.template = template;
        }
        
        extractors.push(extractor);
      }

      // XPath Extractor
      else if (tag === 'XPathExtractor') {
        const refName = getStringProp(child, 'XPathExtractor.refname');
        const xpathQuery = getStringProp(child, 'XPathExtractor.xpathQuery');
        const defaultValue = getStringProp(child, 'XPathExtractor.default');
        
        if (!xpathQuery) continue; // Skip if no path
        
        const extractor = {
          type: 'xpath',
          var: refName || 'INCOMPLETE',
          path: xpathQuery
        };
        
        if (defaultValue) {
          extractor.default = defaultValue;
        }
        
        extractors.push(extractor);
      }
      
      // Unsupported extractors - add to warnings
      else if (tag === 'BoundaryExtractor' || tag === 'CSS_JQueryExtractor' || tag === 'HtmlExtractor') {
        if (context && context.warnings) {
          const warningMsg = `${tag}${elementName ? ` "${elementName}"` : ''} - Not supported in Relampo`;
          if (!context.warnings.includes(warningMsg)) {
            context.warnings.push(warningMsg);
          }
        }
      }
      
      // Recursively search in child's children
      if (child.children && child.children.length > 0) {
        findExtractors(child);
      }
    }
  }
  
  findExtractors(hashTreeNode);
  
  return extractors.length > 0 ? extractors : null;
}

function parseAssertions(hashTreeNode, context) {
  if (!hashTreeNode) return null;
  
  const assertions = [];
  const sparkScripts = [];
  
  // Recursively search for assertions
  function findAssertions(node) {
    if (!node) return;
    
    for (const child of elementChildren(node)) {
      const tag = child.tagName;
      const elementName = getElementName(child, tag);

      // Response Assertion
      if (tag === 'ResponseAssertion') {
        const testField = getStringProp(child, 'Assertion.test_field');
        const testType = getStringProp(child, 'Assertion.test_type');
        
        // Try both spellings (JMeter has a typo "Asserion" in some versions)
        let testStrings = findDirectChild(child, 'collectionProp', 'name', 'Asserion.test_strings');
        if (!testStrings) {
          testStrings = findDirectChild(child, 'collectionProp', 'name', 'Assertion.test_strings');
        }
        
        const strings = [];
        if (testStrings) {
          for (const stringChild of elementChildren(testStrings)) {
            if (stringChild.tagName === 'stringProp') {
              strings.push(stringChild.textContent?.trim() || '');
            }
          }
        }
        
        const value = strings.length > 0 ? strings[0] : '';
        if (!value) continue; // Skip empty assertions

        // Map test fields and types based on JMeter specification
        // testType: 1=contains, 2=equals, 8=matches(regex), 16=not contains
        if (testField === 'Assertion.response_code' || !testField) {
          // Status code assertion
          assertions.push({
            type: 'status',
            value: parseInt(value) || value
          });
        } else if (testField === 'Assertion.response_data' || testField === '') {
          // Response body assertions
          if (testType === '1') { // Contains
            assertions.push({
              type: 'contains',
              value: value
            });
          } else if (testType === '16') { // Not contains
            assertions.push({
              type: 'not_contains',
              value: value
            });
          } else if (testType === '8') { // Matches (regex)
            assertions.push({
              type: 'regex',
              pattern: value
            });
          } else if (testType === '2') { // Equals
            assertions.push({
              type: 'contains', // Map equals to contains for simplicity
              value: value
            });
          }
        }
      }
      
      // JSR223Assertion - convert to spark script
      else if (tag === 'JSR223Assertion') {
        const script = getStringProp(child, 'script');
        const scriptLanguage = getStringProp(child, 'scriptLanguage');
        
        if (script) {
          let convertedScript = script;
          // Convert Groovy to JavaScript if needed
          if (scriptLanguage === 'groovy' || !scriptLanguage) {
            convertedScript = convertGroovyToJavaScript(script);
          }
          
          sparkScripts.push({
            name: elementName || 'JSR223 Assertion',
            when: 'after',
            script: convertedScript
          });
        }
      }

      // JSON Path Assertion
      else if (tag === 'JSONPathAssertion') {
        const jsonPath = getStringProp(child, 'JSON_PATH');
        const expectedValue = getStringProp(child, 'EXPECTED_VALUE');
      
      if (jsonPath) {
        assertions.push({
          name: elementName,
          type: 'jsonpath',
          path: jsonPath,
          value: expectedValue || true
        });
        }
      }

      // Duration Assertion
      else if (tag === 'DurationAssertion') {
        const duration = getStringProp(child, 'DurationAssertion.duration');
        const durationMs = duration ? parseInt(duration) : 0;
        assertions.push({
          name: elementName,
          type: 'response_time_max',
          value: durationMs > 0 ? `${Math.ceil(durationMs / 1000)}s` : 'INCOMPLETE'
        });
      }
      
      // Unsupported assertions - skip but don't add, add to warnings
      else if (tag === 'SizeAssertion' || tag === 'XMLSchemaAssertion' || tag === 'HTMLAssertion' || 
               tag === 'MD5HexAssertion' || tag === 'XPathAssertion' || tag === 'XPath2Assertion' ||
               tag === 'CompareAssertion' || tag === 'BeanShellAssertion' ||
               tag === 'SMIMEAssertion') {
        // These assertion types are not supported in Relampo
        if (context && context.warnings) {
          const warningMsg = `${tag}${elementName ? ` "${elementName}"` : ''} - Not supported in Relampo`;
          if (!context.warnings.includes(warningMsg)) {
            context.warnings.push(warningMsg);
          }
        }
      }
      // Recursively search in child's children
      if (child.children && child.children.length > 0) {
        findAssertions(child);
      }
    }
  }
  
  findAssertions(hashTreeNode);
  
  // Return both assertions and spark scripts
  return {
    assertions: assertions.length > 0 ? assertions : null,
    sparkScripts: sparkScripts.length > 0 ? sparkScripts : null
  };
}

function convertGroovyToJavaScript(groovyCode) {
  if (!groovyCode) return '';

  let jsCode = groovyCode;

  // Convert variable access: vars.get("name") → vars.name
  jsCode = jsCode.replace(/vars\.get\(["']([^"']+)["']\)/g, 'vars.$1');
  
  // Convert variable set: vars.put("name", value) → vars.name = value
  jsCode = jsCode.replace(/vars\.put\(["']([^"']+)["'],\s*(.+?)\)/g, 'vars.$1 = $2');
  
  // Convert logging: log.info → console.log, log.error → console.error, log.warn → console.warn
  jsCode = jsCode.replace(/log\.info\(/g, 'console.log(');
  jsCode = jsCode.replace(/log\.error\(/g, 'console.error(');
  jsCode = jsCode.replace(/log\.warn\(/g, 'console.warn(');
  
  // Convert response access for PostProcessors
  jsCode = jsCode.replace(/prev\.getResponseDataAsString\(\)/g, 'response.body');
  jsCode = jsCode.replace(/prev\.getResponseCode\(\)/g, 'response.status');
  jsCode = jsCode.replace(/prev\.getTime\(\)/g, 'response.duration_ms');
  jsCode = jsCode.replace(/prev\.getResponseHeaders\(\)/g, 'response.headers');
  
  // Convert JSON operations
  jsCode = jsCode.replace(/new\s+JsonSlurper\(\)\.parseText\(/g, 'JSON.parse(');
  jsCode = jsCode.replace(/JsonOutput\.toJson\(/g, 'JSON.stringify(');
  
  // Convert string operations
  jsCode = jsCode.replace(/\.contains\(/g, '.includes(');
  
  // Convert Base64 encoding
  jsCode = jsCode.replace(/Base64\.getEncoder\(\)\.encode\([^)]+\.getBytes\(\)\)/g, 'btoa(credentials)');
  jsCode = jsCode.replace(/Base64\.getDecoder\(\)\.decode\(/g, 'atob(');
  jsCode = jsCode.replace(/Base64\.encodeBase64String\(([^)]+)\.getBytes\([^)]*\)\)/g, 'btoa($1)');
  
  // Convert variable declarations: def → var/let/const
  jsCode = jsCode.replace(/\bdef\s+/g, 'var ');
  
  // Convert Groovy regex operations
  // (text =~ /pattern/) → text.match(/pattern/)
  jsCode = jsCode.replace(/\(([^)]+)\s*=~\s*\/([^\/]+)\/([gim]*)\)/g, '$1.match(/$2/$3)');
  jsCode = jsCode.replace(/([a-zA-Z_][a-zA-Z0-9_.]*)\s*=~\s*\/([^\/]+)\/([gim]*)/g, '$1.match(/$2/$3)');
  
  // m.group(n) → m[n]
  jsCode = jsCode.replace(/\.group\((\d+)\)/g, '[$1]');
  
  // m.find() → m !== null
  jsCode = jsCode.replace(/\.find\(\)/g, ' !== null');
  
  // AssertionResult patterns for JSR223Assertion
  jsCode = jsCode.replace(/AssertionResult\.setFailureMessage\(([^)]+)\)/g, 'throw new Error($1)');
  jsCode = jsCode.replace(/AssertionResult\.setFailure\(true\)/g, 'throw new Error("Assertion failed")');
  
  // Convert System.currentTimeMillis() → Date.now()
  jsCode = jsCode.replace(/System\.currentTimeMillis\(\)/g, 'Date.now()');
  
  // Convert UUID.randomUUID().toString() to JavaScript UUID generation
  if (jsCode.includes('UUID.randomUUID()')) {
    jsCode = jsCode.replace(/UUID\.randomUUID\(\)\.toString\(\)/g, 
      "'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0; var v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); })");
  }
  
  // Remove import statements
  jsCode = jsCode.replace(/^\s*import\s+.+$/gm, '');
  
  // Clean up extra whitespace
  jsCode = jsCode.trim();
  
  return jsCode;
}

function convertIfCondition(condition) {
  if (!condition) return 'true';

  let jsCondition = condition.trim();

  // Handle ${__groovy(...)} function
  const groovyMatch = jsCondition.match(/\$\{__groovy\((.+?)\)\}/s);
  if (groovyMatch) {
    jsCondition = groovyMatch[1];
    // Convert vars.get("name") → vars.name
    jsCondition = jsCondition.replace(/vars\.get\(["']([^"']+)["']\)/g, 'vars.$1');
    // Convert Groovy == to JavaScript ===
    jsCondition = jsCondition.replace(/\s==\s/g, ' === ');
    jsCondition = jsCondition.replace(/\s!=\s/g, ' !== ');
    return jsCondition;
  }

  // Handle ${__javaScript(...)} function
  const jsMatch = jsCondition.match(/\$\{__javaScript\((.+?)\)\}/s);
  if (jsMatch) {
    jsCondition = jsMatch[1];
    // Convert vars.get("name") → vars.name
    jsCondition = jsCondition.replace(/vars\.get\(["']([^"']+)["']\)/g, 'vars.$1');
    return jsCondition;
  }

  // Handle simple variable reference: ${varname}
  const varMatch = jsCondition.match(/^\$\{([^}]+)\}$/);
  if (varMatch) {
    return `vars.${varMatch[1]} !== undefined && vars.${varMatch[1]}`;
  }

  // Handle comparison with variable: "${varname}" == "value"
  jsCondition = jsCondition.replace(/"\$\{([^}]+)\}"/g, 'vars.$1');
  jsCondition = jsCondition.replace(/\$\{([^}]+)\}/g, 'vars.$1');
  
  // Convert == to === and != to !==
  jsCondition = jsCondition.replace(/\s==\s/g, ' === ');
  jsCondition = jsCondition.replace(/\s!=\s/g, ' !== ');

  return jsCondition;
}

function parsePrePostProcessors(hashTreeNode, context) {
  if (!hashTreeNode) return null;
  
  const sparkScripts = [];
  
  // Recursively search all descendants for pre/post processors
  function findProcessors(node) {
    if (!node) return;
    
    for (const child of elementChildren(node)) {
      const tag = child.tagName;
      let script = null;
      let when = null;
      let elementName = null;
      
      // JSR223 PreProcessor
      if (tag === 'JSR223PreProcessor') {
        script = getStringProp(child, 'script') || getStringProp(child, 'ScriptText');
        when = 'before';
        elementName = getElementName(child, 'JSR223 PreProcessor');
      }
      // JSR223 PostProcessor
      else if (tag === 'JSR223PostProcessor') {
        script = getStringProp(child, 'script') || getStringProp(child, 'ScriptText');
        when = 'after';
        elementName = getElementName(child, 'JSR223 PostProcessor');
      }
      // BeanShell PreProcessor
      else if (tag === 'BeanShellPreProcessor') {
        script = getStringProp(child, 'script') || getStringProp(child, 'BeanShellPreProcessor.script');
        when = 'before';
        elementName = getElementName(child, 'BeanShell PreProcessor');
      }
      // BeanShell PostProcessor
      else if (tag === 'BeanShellPostProcessor') {
        script = getStringProp(child, 'script') || getStringProp(child, 'BeanShellPostProcessor.script');
        when = 'after';
        elementName = getElementName(child, 'BeanShell PostProcessor');
      }
      
      if (script && when) {
        const convertedScript = convertGroovyToJavaScript(script);
        if (convertedScript) {
          sparkScripts.push({
            name: elementName,
            when: when,
            script: convertedScript
          });
          // Don't count here - will be counted when added to request
        }
      }
      
      // Recursively search in child's children
      if (child.children && child.children.length > 0) {
        findProcessors(child);
      }
    }
  }
  
  findProcessors(hashTreeNode);
  
  return sparkScripts.length > 0 ? sparkScripts : null;
}

function convertSamplerToStep(sampler, samplerHashTree, context = {}) {
  const method = (getStringProp(sampler, 'HTTPSampler.method') || 'GET').toUpperCase();
  const args = extractSamplerArguments(sampler);
  const postBodyRaw = getBoolProp(sampler, 'HTTPSampler.postBodyRaw');
  const samplerName = getElementName(sampler, '');

  let url = normalizePath(getStringProp(sampler, 'HTTPSampler.path'));
  const methodUsesQuery = ['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(method);
  if (methodUsesQuery && args.length > 0) {
    url = attachQueryParams(url, args);
  }

  const request = {
    method,
    url
  };

  // Add name if present
  if (samplerName) {
    request.name = samplerName;
  }

  const headers = findHeadersInHashTree(samplerHashTree);
  if (Object.keys(headers).length > 0) {
    // Convert JMeter variables in headers
    const convertedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      convertedHeaders[key] = convertJMeterVarToRelampo(value);
    }
    request.headers = convertedHeaders;
  }

  if (!methodUsesQuery && args.length > 0) {
    if (postBodyRaw) {
      const body = args.map((arg) => arg.value ?? '').join('');
      request.body = convertJMeterVarToRelampo(body);
    } else {
      const encoded = buildBodyFromArgs(args);
      if (encoded.length > 0) {
        request.body = encoded;
      }
    }
  }

  // Add spark scripts (pre/post processors)
  const sparkScripts = parsePrePostProcessors(samplerHashTree, context);
  const allSparkScripts = [];
  
  // Add global spark scripts (from Thread Group level) if this is the first request
  if (context.globalSparkScripts && context.globalSparkScripts.length > 0 && !context.globalSparkAdded) {
    allSparkScripts.push(...context.globalSparkScripts);
    context.globalSparkAdded = true;
    // Note: global spark scripts are already counted when added to globalSparkScripts array
  }
  
  // Add request-specific spark scripts
  if (sparkScripts) {
    allSparkScripts.push(...sparkScripts);
    if (context.stats) context.stats.sparkScripts += sparkScripts.length;
  }
  
  if (allSparkScripts.length > 0) {
    request.spark = allSparkScripts;
  }

  // Add extractors
  const extractors = parseExtractors(samplerHashTree, context);
  if (extractors) {
    request.extractors = extractors;
    if (context.stats) context.stats.extractors += extractors.length;
  }

  // Add assertions and JSR223Assertion spark scripts
  const assertionResult = parseAssertions(samplerHashTree, context);
  if (assertionResult) {
    if (assertionResult.assertions) {
      request.assertions = assertionResult.assertions;
      if (context.stats) context.stats.assertions += assertionResult.assertions.length;
    }
    // Add JSR223Assertion spark scripts
    if (assertionResult.sparkScripts) {
      allSparkScripts.push(...assertionResult.sparkScripts);
      if (context.stats) context.stats.sparkScripts += assertionResult.sparkScripts.length;
    }
  }

  // Count this request
  if (context.stats) context.stats.requests++;

  return { request };
}

function parseStepsFromHashTree(hashTreeNode, inheritedDefaults, context = {}) {
  const steps = [];
  let localDefaults = { ...inheritedDefaults };
  
  // Collect global pre/post processors at Thread Group level
  if (!context.globalSparkScripts) {
    context.globalSparkScripts = [];
  }
  
  // Track unsupported elements
  if (!context.warnings) {
    context.warnings = [];
  }

  for (const pair of getHashTreePairs(hashTreeNode)) {
    const tag = pair.element.tagName;
    const elementName = getElementName(pair.element, tag);

    if (tag === 'ConfigTestElement') {
      localDefaults = mergeSamplerDefaults(localDefaults, extractSamplerDefaults(pair.element));
      continue;
    }

    // Collect CSV Data Set Configs at root level
    if (tag === 'CSVDataSet') {
      const csvData = parseCSVDataSet(pair.element);
      if (csvData && context.csvDataSources) {
        context.csvDataSources.push(csvData);
      }
      continue;
    }

    // Collect User Defined Variables at root level
    if (tag === 'Arguments' && context.variables) {
      const vars = parseUserDefinedVariables(pair.element);
      Object.assign(context.variables, vars);
      continue;
    }

    if (tag === 'HeaderManager' || tag === 'CacheManager') {
      continue;
    }
    
    // Parse CookieManager
    if (tag === 'CookieManager') {
      const clearEachIteration = getBoolProp(pair.element, 'CookieManager.clearEachIteration');
      if (!context.cookieManager) {
        context.cookieManager = {
          clearEachIteration: clearEachIteration
        };
      }
      continue;
    }
    
    // Detect global pre/post processors at Thread Group level
    if (tag === 'JSR223PreProcessor' || tag === 'BeanShellPreProcessor') {
      const script = getStringProp(pair.element, 'script') || getStringProp(pair.element, 'ScriptText');
      if (script) {
        const convertedScript = convertGroovyToJavaScript(script);
        if (convertedScript) {
          const elementName = getElementName(pair.element, tag === 'JSR223PreProcessor' ? 'JSR223 PreProcessor' : 'BeanShell PreProcessor');
          context.globalSparkScripts.push({
            name: elementName,
            when: 'before',
            script: convertedScript
          });
          if (context.stats) context.stats.sparkScripts++;
        }
      }
      continue;
    }
    
    if (tag === 'JSR223PostProcessor' || tag === 'BeanShellPostProcessor') {
      const script = getStringProp(pair.element, 'script') || getStringProp(pair.element, 'ScriptText');
      if (script) {
        const convertedScript = convertGroovyToJavaScript(script);
        if (convertedScript) {
          const elementName = getElementName(pair.element, tag === 'JSR223PostProcessor' ? 'JSR223 PostProcessor' : 'BeanShell PostProcessor');
          context.globalSparkScripts.push({
            name: elementName,
            when: 'after',
            script: convertedScript
          });
          if (context.stats) context.stats.sparkScripts++;
        }
      }
      continue;
    }

    // Handle timers
    if (tag === 'ConstantTimer') {
      const delay = getStringProp(pair.element, 'ConstantTimer.delay');
      if (delay) {
        const delayMs = parseInt(delay);
        if (delayMs > 0) {
          const seconds = Math.ceil(delayMs / 1000);
          steps.push({ 
            think_time: {
              name: elementName,
              duration: `${seconds}s`
            }
          });
          if (context.stats) context.stats.timers++;
        }
      }
      continue;
    }

    if (tag === 'UniformRandomTimer') {
      const constantDelay = getStringProp(pair.element, 'ConstantTimer.delay');
      const range = getStringProp(pair.element, 'RandomTimer.range');
      if (constantDelay && range) {
        const minMs = parseInt(constantDelay);
        const rangeMs = parseInt(range);
        const maxMs = minMs + rangeMs;
        steps.push({
          think_time: {
            name: elementName,
            min: `${Math.ceil(minMs / 1000)}s`,
            max: `${Math.ceil(maxMs / 1000)}s`,
            distribution: 'uniform'
          }
        });
        if (context.stats) context.stats.timers++;
      }
      continue;
    }

    if (tag === 'GaussianRandomTimer') {
      const constantDelay = getStringProp(pair.element, 'ConstantTimer.delay');
      const range = getStringProp(pair.element, 'RandomTimer.range');
      if (constantDelay && range) {
        const meanMs = parseInt(constantDelay);
        const stdDevMs = parseInt(range);
        steps.push({
          think_time: {
            name: elementName,
            mean: `${Math.ceil(meanMs / 1000)}s`,
            std_dev: `${Math.ceil(stdDevMs / 1000)}s`,
            distribution: 'gaussian'
          }
        });
        if (context.stats) context.stats.timers++;
      }
      continue;
    }
    
    // Unsupported timers
    if (tag === 'JSR223Timer' || tag === 'BeanShellTimer' || tag === 'PoissonRandomTimer' || tag === 'SynchronizingTimer') {
      const warningMsg = `${tag}${elementName ? ` "${elementName}"` : ''} - Not supported in Relampo`;
      if (!context.warnings.includes(warningMsg)) {
        context.warnings.push(warningMsg);
      }
      continue;
    }

    if (tag === 'HTTPSamplerProxy') {
      const stepData = convertSamplerToStep(pair.element, pair.hashTree, context);
      const enabled = pair.element.getAttribute('enabled');
      
      // Mark disabled requests
      if (enabled === 'false') {
        stepData.request.enabled = false;
      }
      
      steps.push(stepData);
      continue;
    }

    // Handle If Controller
    if (tag === 'IfController') {
      const condition = getStringProp(pair.element, 'IfController.condition');
      const convertedCondition = convertIfCondition(condition);
      const nestedSteps = parseStepsFromHashTree(pair.hashTree, localDefaults, context);
      if (nestedSteps.length > 0) {
        steps.push({
          if: convertedCondition,
          steps: nestedSteps
        });
        if (context.stats) context.stats.controllers++;
      }
      continue;
    }

    // Handle Loop Controller
    if (tag === 'LoopController') {
      const loops = getStringProp(pair.element, 'LoopController.loops');
      const loopCount = parseInt(loops) || 1;
      const nestedSteps = parseStepsFromHashTree(pair.hashTree, localDefaults, context);
      if (nestedSteps.length > 0) {
        steps.push({
          loop: loopCount,
          steps: nestedSteps
        });
        if (context.stats) context.stats.controllers++;
      }
      continue;
    }
    
    // Handle ThreadGroup - process its content transparently (don't count as controller)
    if (tag === 'ThreadGroup') {
      const nestedSteps = parseStepsFromHashTree(pair.hashTree, localDefaults, context);
      steps.push(...nestedSteps);
      continue;
    }

    if (CONTROLLER_TAGS.has(tag)) {
      const groupName = getElementName(pair.element, tag);
      const nestedSteps = parseStepsFromHashTree(pair.hashTree, localDefaults, context);
      if (nestedSteps.length > 0) {
        steps.push({
          group: {
            name: groupName,
            steps: nestedSteps
          }
        });
        if (context.stats) context.stats.controllers++;
      }
      continue;
    }

    // Detect unsupported elements
    const unsupportedElements = [
      // Listeners
      'ResultCollector',
      'ViewResultsFullVisualizer',
      'SummaryReport',
      'GraphResults',
      'AggregateReport',
      'TableVisualizer',
      'Summariser',
      'RespTimeGraphVisualizer',
      'StatVisualizer',
      'MailerVisualizer',
      'BeanShellListener',
      'BackendListener',
      // Non-HTTP Samplers
      'JDBCSampler',
      'FTPSampler',
      'SMTPSampler',
      'JMSSampler',
      'TCPSampler',
      'LDAPSampler',
      'LDAPExtSampler',
      'MailReaderSampler',
      'JavaSampler',
      'BoltSampler',
      'MongoScriptSampler',
      // Advanced Controllers
      'WhileController',
      'ForeachController',
      'SwitchController',
      'ModuleController',
      'IncludeController',
      'InterleaveController',
      'ThroughputController',
      'TransactionController',
      'RandomController',
      'RandomOrderController',
      'RecordingController',
      // Unsupported Assertions
      'SizeAssertion',
      'XMLSchemaAssertion',
      'HTMLAssertion',
      'MD5HexAssertion',
      'XPathAssertion',
      'XPath2Assertion',
      'CompareAssertion',
      'BeanShellAssertion',
      'SMIMEAssertion',
      // Unsupported Timers
      'JSR223Timer',
      'BeanShellTimer',
      'PoissonRandomTimer',
      'SynchronizingTimer',
      // Config Elements
      'DNSCacheManager',
      'AuthManager',
      'KeystoreConfig',
      'LoginConfig',
      'JavaScriptConfigElement',
      'JDBCConnectionConfiguration',
      'BoltConnectionElement',
      // Other
      'ProxyControl',
      'SetupThreadGroup',
      'PostThreadGroup',
      'TestAction',
      'DebugSampler',
      'FlowControlAction',
      'JSR223Sampler',
      'BeanShellSampler'
    ];
    
    if (unsupportedElements.includes(tag)) {
      const warningMsg = `${tag}${elementName ? ` "${elementName}"` : ''} - Not supported in Relampo`;
      if (!context.warnings.includes(warningMsg)) {
        context.warnings.push(warningMsg);
      }
      continue;
    }

    if (pair.hashTree) {
      steps.push(...parseStepsFromHashTree(pair.hashTree, localDefaults, context));
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

  // Create context to collect variables, CSV configs, and statistics
  const context = {
    variables: {},
    csvDataSources: [],
    stats: {
      requests: 0,
      extractors: 0,
      assertions: 0,
      sparkScripts: 0,
      variables: 0,
      dataSources: 0,
      timers: 0,
      controllers: 0
    },
    warnings: [],
    globalSparkScripts: []
  };
  
  const detectedBaseURL = findBaseURLInTree(targetTree, {});
  const globalHeaders = {
    Accept: 'application/json',
    'User-Agent': options.defaultUA
  };

  // Reset counters that parseStepsFromHashTree will populate
  context.warnings = [];
  context.globalSparkScripts = [];
  
  const steps = parseStepsFromHashTree(targetTree, {}, context);

  // Update stats with variables and data sources count
  context.stats.variables = Object.keys(context.variables).length;
  context.stats.dataSources = context.csvDataSources.length;

  const pulse = {
    test: {
      name: getElementName(testPlan, 'Imported JMX Plan'),
      description: 'Imported from JMX test plan',
      version: '1.0'
    }
  };

  // Add variables if any
  if (Object.keys(context.variables).length > 0) {
    pulse.variables = context.variables;
  } else {
    pulse.variables = {};
  }

  // Add data_source if CSV configs found (use first one for now)
  if (context.csvDataSources.length > 0) {
    pulse.data_source = context.csvDataSources[0];
  }

  pulse.http_defaults = {
    timeout: options.defaultTimeout,
    headers: globalHeaders
  };

  if (detectedBaseURL) {
    pulse.variables.base_url = detectedBaseURL;
    pulse.http_defaults.base_url = detectedBaseURL;
  }

  // Determine cookies configuration from CookieManager
  let cookiesConfig = 'auto';
  if (context.cookieManager) {
    if (context.cookieManager.clearEachIteration) {
      cookiesConfig = 'none'; // Clear each iteration means don't keep cookies
    }
  }
  
  pulse.scenarios = [
    {
      name: 'Imported Scenario',
      load: {
        users: options.defaultUsers,
        duration: options.defaultDuration,
        ramp_up: options.defaultRampUp
      },
      cookies: cookiesConfig,
      steps
    }
  ];

  pulse.metrics = {
    enabled: true
  };

  // Generate YAML with header comments
  const yaml = stringifyYAML(pulse);
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
  
  let header = `# ============================================================================
# RELAMPO YAML - CONVERTED FROM JMETER TEST PLAN
# ============================================================================
# Conversion Date: ${timestamp}
#
# CONVERSION STATS:
# - HTTP Requests: ${context.stats.requests}
# - Extractors: ${context.stats.extractors}
# - Assertions: ${context.stats.assertions}
# - Spark Scripts: ${context.stats.sparkScripts}
# - User Variables: ${context.stats.variables}
# - CSV Data Sources: ${context.stats.dataSources}
# - Timers: ${context.stats.timers}
# - Controllers: ${context.stats.controllers}
# ============================================================================
`;

  // Add warnings for unsupported elements
  if (context.warnings && context.warnings.length > 0) {
    header += `#
# ⚠️  UNSUPPORTED ELEMENTS (not converted):
`;
    for (const warning of context.warnings) {
      header += `#   - ${warning}
`;
    }
    header += `# ============================================================================
`;
  }
  
  header += `\n`;

  return header + yaml;
}
