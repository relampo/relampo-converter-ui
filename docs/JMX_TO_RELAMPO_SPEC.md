# JMX to Relampo YAML Conversion Specification

**Document Version:** 1.0  
**Date:** 2026-02-11  
**Status:** Draft

## 1. Overview

This document defines the comprehensive mapping between Apache JMeter test plan components (.jmx files) and Relampo YAML format. The converter extracts supported JMeter elements and transforms them into equivalent Relampo constructs while maintaining test logic and behavior.

### 1.1 Objectives

- Enable seamless migration from JMeter to Relampo
- Preserve test logic, flow control, and data operations
- Convert only supported components (ignore unsupported JMeter plugins/listeners)
- Generate clean, readable Relampo YAML with proper structure

### 1.2 Scope

**IN SCOPE:**
- HTTP samplers and configuration elements
- Data sources (CSV Data Set Config)
- Variables (User Defined Variables)
- Pre/Post processors (JSR223, BeanShell)
- Extractors (JSON, Regex, XPath, Boundary)
- Assertions (Response, JSON, Duration, Size)
- Controllers (Simple, Loop, If, Transaction)
- Timers (Constant, Uniform Random, Gaussian)
- Managers (Cookie, Cache, Header, HTTP Defaults)

**OUT OF SCOPE:**
- Listeners (View Results Tree, Graph Results, Summary Report, etc.)
- Non-HTTP samplers (JDBC, FTP, SMTP, JMS, etc.)
- Advanced controllers (While, ForEach, Switch - partial support)
- JMeter plugins and custom components
- Thread group configuration (converted to scenario load config)

---

## 2. Component Mapping Reference

### 2.1 Test Plan Structure

#### JMeter TestPlan
```xml
<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="My Test Plan">
  <stringProp name="TestPlan.comments">Test description</stringProp>
  <boolProp name="TestPlan.functional_mode">false</boolProp>
  <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
  <elementProp name="TestPlan.user_defined_variables">
    <!-- Variables here -->
  </elementProp>
</TestPlan>
```

#### Relampo YAML
```yaml
test:
  name: "My Test Plan"
  description: "Test description"
  version: "1.0"

variables:
  # User defined variables here
```

**Mapping:**
- `testname` → `test.name`
- `TestPlan.comments` → `test.description`
- Version set to "1.0" by default

---

### 2.2 Variables and Data Sources

#### 2.2.1 User Defined Variables

**JMeter:**
```xml
<Arguments guiclass="ArgumentsPanel" testclass="Arguments" testname="User Defined Variables">
  <collectionProp name="Arguments.arguments">
    <elementProp name="BASE_URL" elementType="Argument">
      <stringProp name="Argument.name">BASE_URL</stringProp>
      <stringProp name="Argument.value">https://api.example.com</stringProp>
    </elementProp>
    <elementProp name="API_KEY" elementType="Argument">
      <stringProp name="Argument.name">API_KEY</stringProp>
      <stringProp name="Argument.value">secret123</stringProp>
    </elementProp>
  </collectionProp>
</Arguments>
```

**Relampo:**
```yaml
variables:
  BASE_URL: "https://api.example.com"
  API_KEY: "secret123"
```

---

#### 2.2.2 CSV Data Set Config

**JMeter:**
```xml
<CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="Users CSV">
  <stringProp name="filename">data/users.csv</stringProp>
  <stringProp name="fileEncoding">UTF-8</stringProp>
  <stringProp name="variableNames">email,password,name</stringProp>
  <boolProp name="ignoreFirstLine">true</boolProp>
  <stringProp name="delimiter">,</stringProp>
  <boolProp name="quotedData">false</boolProp>
  <boolProp name="recycle">true</boolProp>
  <boolProp name="stopThread">false</boolProp>
  <stringProp name="shareMode">shareMode.all</stringProp>
</CSVDataSet>
```

**Relampo:**
```yaml
data_source:
  type: csv
  file: "data/users.csv"
  mode: shared  # shareMode.all → shared, shareMode.group → per_vu
  strategy: sequential
  on_exhausted: recycle  # recycle=true → recycle, stopThread=true → stop
  bind:
    email: email
    password: password
    name: name
```

**Mapping Rules:**
- `shareMode.all` → `mode: shared`
- `shareMode.group` or `shareMode.thread` → `mode: per_vu`
- `recycle=true` → `on_exhausted: recycle`
- `stopThread=true` → `on_exhausted: stop`
- `variableNames` → `bind` (column_name: var_name)
- If `variableNames` is empty, use CSV header row as variable names

**Location:**
- Root level `data_source` for global CSV access
- Request level `data_source` for per-request CSV iteration

---

### 2.3 HTTP Configuration

#### 2.3.1 HTTP Request Defaults (ConfigTestElement)

**JMeter:**
```xml
<ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Defaults">
  <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
  <stringProp name="HTTPSampler.port">443</stringProp>
  <stringProp name="HTTPSampler.protocol">https</stringProp>
  <stringProp name="HTTPSampler.path"></stringProp>
  <stringProp name="HTTPSampler.connect_timeout">10000</stringProp>
  <stringProp name="HTTPSampler.response_timeout">30000</stringProp>
  <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
</ConfigTestElement>
```

**Relampo:**
```yaml
http_defaults:
  base_url: "https://api.example.com"
  timeout: "30s"
  follow_redirects: true
  headers:
    Accept: "application/json"
    User-Agent: "Relampo/1.0"
```

**Mapping:**
- `protocol://domain:port` → `base_url`
- `response_timeout` → `timeout` (convert ms to duration string)
- `follow_redirects` → `follow_redirects`
- Default headers added automatically

---

#### 2.3.2 HTTP Header Manager

**JMeter:**
```xml
<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Headers">
  <collectionProp name="HeaderManager.headers">
    <elementProp name="" elementType="Header">
      <stringProp name="Header.name">Authorization</stringProp>
      <stringProp name="Header.value">Bearer ${token}</stringProp>
    </elementProp>
    <elementProp name="" elementType="Header">
      <stringProp name="Header.name">Content-Type</stringProp>
      <stringProp name="Header.value">application/json</stringProp>
    </elementProp>
  </collectionProp>
</HeaderManager>
```

**Relampo:**
```yaml
# Global level (if attached to Test Plan or Thread Group)
http_defaults:
  headers:
    Authorization: "Bearer {{token}}"
    Content-Type: "application/json"

# Request level (if attached to specific sampler)
- request:
    method: POST
    url: /api/users
    headers:
      Authorization: "Bearer {{token}}"
      Content-Type: "application/json"
```

**Mapping:**
- JMeter variables `${varname}` → Relampo `{{varname}}`
- Headers at Test Plan level → `http_defaults.headers`
- Headers at sampler level → `request.headers`

---

#### 2.3.3 HTTP Cookie Manager

**JMeter:**
```xml
<CookieManager guiclass="CookiePanel" testclass="CookieManager" testname="HTTP Cookie Manager">
  <boolProp name="CookieManager.clearEachIteration">false</boolProp>
  <stringProp name="CookieManager.policy">default</stringProp>
</CookieManager>
```

**Relampo:**
```yaml
scenarios:
  - name: "My Scenario"
    cookies:
      mode: auto
      persist_across_iterations: true  # clearEachIteration=false
```

**Mapping:**
- Cookie Manager present → `cookies.mode: auto`
- `clearEachIteration=false` → `persist_across_iterations: true`
- `clearEachIteration=true` → `persist_across_iterations: false`

---

#### 2.3.4 HTTP Cache Manager

**JMeter:**
```xml
<CacheManager guiclass="CacheManagerGui" testclass="CacheManager" testname="HTTP Cache Manager">
  <boolProp name="clearEachIteration">false</boolProp>
  <boolProp name="useExpires">true</boolProp>
</CacheManager>
```

**Relampo:**
```yaml
scenarios:
  - name: "My Scenario"
    cache_manager:
      enabled: true
      clear_each_iteration: false
```

---

### 2.4 HTTP Samplers

#### 2.4.1 HTTP Request Sampler (HTTPSamplerProxy)

**JMeter:**
```xml
<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="GET Users">
  <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
  <stringProp name="HTTPSampler.port">443</stringProp>
  <stringProp name="HTTPSampler.protocol">https</stringProp>
  <stringProp name="HTTPSampler.path">/api/v1/users</stringProp>
  <stringProp name="HTTPSampler.method">GET</stringProp>
  <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
  <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
    <collectionProp name="Arguments.arguments">
      <elementProp name="page" elementType="HTTPArgument">
        <stringProp name="Argument.name">page</stringProp>
        <stringProp name="Argument.value">1</stringProp>
        <boolProp name="HTTPArgument.always_encode">false</boolProp>
        <boolProp name="HTTPArgument.use_equals">true</boolProp>
      </elementProp>
    </collectionProp>
  </elementProp>
</HTTPSamplerProxy>
```

**Relampo:**
```yaml
- request:
    name: "GET Users"
    method: GET
    url: /api/v1/users
    query_params:
      page: "1"
```

**Mapping:**
- `testname` → `name`
- `HTTPSampler.method` → `method`
- `HTTPSampler.path` → `url` (relative if base_url defined)
- Query string arguments → `query_params`
- Body arguments (POST) → `body` (URL-encoded or raw)
- `protocol://domain:port` extracted as `base_url` if not in http_defaults

---

#### 2.4.2 POST Request with Body

**JMeter:**
```xml
<HTTPSamplerProxy testname="Create User" testclass="HTTPSamplerProxy">
  <stringProp name="HTTPSampler.path">/api/v1/users</stringProp>
  <stringProp name="HTTPSampler.method">POST</stringProp>
  <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
    <collectionProp name="Arguments.arguments">
      <elementProp name="" elementType="HTTPArgument">
        <stringProp name="Argument.value">{"name":"${username}","email":"${email}"}</stringProp>
        <boolProp name="HTTPArgument.always_encode">false</boolProp>
      </elementProp>
    </collectionProp>
  </elementProp>
</HTTPSamplerProxy>
```

**Relampo:**
```yaml
- request:
    name: "Create User"
    method: POST
    url: /api/v1/users
    headers:
      Content-Type: "application/json"
    body: '{"name":"{{username}}","email":"{{email}}"}'
```

**Mapping:**
- `postBodyRaw=true` → body as raw string
- `postBodyRaw=false` → body as URL-encoded parameters
- JMeter `${var}` → Relampo `{{var}}`

---

### 2.5 Extractors

#### 2.5.1 JSON Extractor

**JMeter:**
```xml
<JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="Extract Token">
  <stringProp name="JSONPostProcessor.referenceNames">auth_token</stringProp>
  <stringProp name="JSONPostProcessor.jsonPathExprs">$.data.token</stringProp>
  <stringProp name="JSONPostProcessor.match_numbers">1</stringProp>
  <stringProp name="JSONPostProcessor.defaultValues">NOTFOUND</stringProp>
</JSONPostProcessor>
```

**Relampo:**
```yaml
- request:
    method: POST
    url: /api/login
    body: '{"username":"user","password":"pass"}'
    extract:
      auth_token: "jsonpath(\"$.data.token\")"
      # Or with default value:
      # auth_token: "jsonpath(\"$.data.token\") || \"NOTFOUND\""
```

**Mapping:**
- `referenceNames` → variable name in extract map
- `jsonPathExprs` → `jsonpath("expression")`
- `defaultValues` → fallback using `|| "default"`
- `match_numbers` → index in JSONPath (default: first match)

---

#### 2.5.2 Regular Expression Extractor

**JMeter:**
```xml
<RegexExtractor guiclass="RegexExtractorGui" testclass="RegexExtractor" testname="Extract User ID">
  <stringProp name="RegexExtractor.refname">user_id</stringProp>
  <stringProp name="RegexExtractor.regex">"id":(\d+)</stringProp>
  <stringProp name="RegexExtractor.template">$1$</stringProp>
  <stringProp name="RegexExtractor.default">0</stringProp>
  <stringProp name="RegexExtractor.match_number">1</stringProp>
</RegexExtractor>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /api/user
    extract:
      user_id: 'regex("\"id\":(\\d+)")'
      # With default:
      # user_id: 'regex("\"id\":(\\d+)") || "0"'
```

**Mapping:**
- `refname` → variable name
- `regex` → `regex("pattern")`
- `template` → captured group (default: $1$)
- `default` → fallback using `|| "value"`
- Escape backslashes properly in YAML

---

#### 2.5.3 XPath Extractor

**JMeter:**
```xml
<XPathExtractor guiclass="XPathExtractorGui" testclass="XPathExtractor" testname="Extract Title">
  <stringProp name="XPathExtractor.refname">page_title</stringProp>
  <stringProp name="XPathExtractor.xpathQuery">//title/text()</stringProp>
  <stringProp name="XPathExtractor.default">No Title</stringProp>
  <boolProp name="XPathExtractor.validate">false</boolProp>
  <boolProp name="XPathExtractor.tolerant">true</boolProp>
</XPathExtractor>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /page.html
    extract:
      page_title: 'xpath("//title/text()") || "No Title"'
```

---

#### 2.5.4 Boundary Extractor

**JMeter:**
```xml
<BoundaryExtractor guiclass="BoundaryExtractorGui" testclass="BoundaryExtractor" testname="Extract Session">
  <stringProp name="BoundaryExtractor.refname">session_id</stringProp>
  <stringProp name="BoundaryExtractor.lboundary">session=</stringProp>
  <stringProp name="BoundaryExtractor.rboundary">;</stringProp>
  <stringProp name="BoundaryExtractor.default">NONE</stringProp>
  <stringProp name="BoundaryExtractor.match_number">1</stringProp>
</BoundaryExtractor>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /login
    extract:
      session_id: 'boundary("session=", ";") || "NONE"'
```

**Note:** Boundary extraction can be emulated with regex:
```yaml
extract:
  session_id: 'regex("session=([^;]+)") || "NONE"'
```

---

### 2.6 Assertions

#### 2.6.1 Response Assertion

**JMeter:**
```xml
<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Assert Success">
  <collectionProp name="Asserion.test_strings">
    <stringProp name="49586">200</stringProp>
  </collectionProp>
  <stringProp name="Assertion.test_field">Assertion.response_code</stringProp>
  <intProp name="Assertion.test_type">8</intProp>
  <boolProp name="Assertion.assume_success">false</boolProp>
</ResponseAssertion>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /api/status
    assert:
      status: 200
      # Or for response body:
      # body_contains: "success"
      # body_matches: "regex pattern"
```

**Mapping:**
- `response_code` test → `assert.status`
- `response_data` contains → `assert.body_contains`
- `response_data` matches → `assert.body_matches`
- `response_headers` → `assert.header_contains` or custom assert

**Test Types:**
- `test_type=8` (equals) → exact match
- `test_type=16` (contains) → `_contains` suffix
- `test_type=2` (matches) → `_matches` suffix

---

#### 2.6.2 JSON Assertion

**JMeter:**
```xml
<JSONPathAssertion guiclass="JSONPathAssertionGui" testclass="JSONPathAssertion" testname="Assert Status">
  <stringProp name="JSON_PATH">$.status</stringProp>
  <stringProp name="EXPECTED_VALUE">success</stringProp>
  <boolProp name="JSONVALIDATION">true</boolProp>
  <boolProp name="EXPECT_NULL">false</boolProp>
  <boolProp name="INVERT">false</boolProp>
</JSONPathAssertion>
```

**Relampo:**
```yaml
- request:
    method: POST
    url: /api/action
    assert:
      jsonpath:
        "$.status": "success"
        "$.code": 200
```

---

#### 2.6.3 Duration Assertion

**JMeter:**
```xml
<DurationAssertion guiclass="DurationAssertionGui" testclass="DurationAssertion" testname="Assert Fast">
  <stringProp name="DurationAssertion.duration">2000</stringProp>
</DurationAssertion>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /api/fast
    assert:
      response_time_max: "2s"  # 2000ms → 2s
```

---

#### 2.6.4 Size Assertion

**JMeter:**
```xml
<SizeAssertion guiclass="SizeAssertionGui" testclass="SizeAssertion" testname="Assert Size">
  <stringProp name="Assertion.test_field">SizeAssertion.response_data</stringProp>
  <stringProp name="SizeAssertion.size">1000</stringProp>
  <intProp name="SizeAssertion.operator">1</intProp>
</SizeAssertion>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /api/data
    assert:
      response_size_max: 1000  # operator=1 (less than)
      # operator=2 → response_size_min
      # operator=3 → response_size (equals)
```

---

### 2.7 Pre/Post Processors

#### 2.7.1 JSR223 PreProcessor

**JMeter:**
```xml
<JSR223PreProcessor guiclass="TestBeanGUI" testclass="JSR223PreProcessor" testname="Setup Variables">
  <stringProp name="scriptLanguage">groovy</stringProp>
  <stringProp name="script">
    import java.util.UUID
    
    def requestId = UUID.randomUUID().toString()
    vars.put("request_id", requestId)
    
    def timestamp = System.currentTimeMillis().toString()
    vars.put("timestamp", timestamp)
    
    log.info("Generated request_id: " + requestId)
  </stringProp>
</JSR223PreProcessor>
```

**Relampo:**
```yaml
- request:
    name: "API Call"
    
    spark:
      - when: before
        script: |
          // Generate unique request ID
          vars.request_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            var v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          
          // Current timestamp
          vars.timestamp = Date.now().toString();
          
          console.log("Generated request_id: " + vars.request_id);
    
    method: GET
    url: /api/endpoint
    headers:
      X-Request-ID: "{{request_id}}"
      X-Timestamp: "{{timestamp}}"
```

**Mapping:**
- JSR223PreProcessor → `spark` with `when: before`
- Groovy/Java code → JavaScript equivalent
- `vars.put("name", value)` → `vars.name = value`
- `vars.get("name")` → `vars.name`
- `log.info(msg)` → `console.log(msg)`

---

#### 2.7.2 JSR223 PostProcessor

**JMeter:**
```xml
<JSR223PostProcessor guiclass="TestBeanGUI" testclass="JSR223PostProcessor" testname="Validate Response">
  <stringProp name="scriptLanguage">groovy</stringProp>
  <stringProp name="script">
    import groovy.json.JsonSlurper
    
    def response = prev.getResponseDataAsString()
    def json = new JsonSlurper().parseText(response)
    
    if (json.status != "success") {
      log.error("Request failed with status: " + json.status)
    } else {
      log.info("Request successful")
      vars.put("user_id", json.data.id.toString())
    }
    
    vars.put("response_time", prev.getTime().toString())
  </stringProp>
</JSR223PostProcessor>
```

**Relampo:**
```yaml
- request:
    name: "Create User"
    method: POST
    url: /api/users
    body: '{"name":"John"}'
    
    spark:
      - when: after
        script: |
          // Parse JSON response
          var json = JSON.parse(response.body);
          
          if (json.status !== "success") {
            console.error("Request failed with status: " + json.status);
          } else {
            console.log("Request successful");
            vars.user_id = json.data.id.toString();
          }
          
          vars.response_time = response.duration_ms.toString();
```

**Mapping:**
- JSR223PostProcessor → `spark` with `when: after`
- `prev.getResponseDataAsString()` → `response.body`
- `prev.getTime()` → `response.duration_ms`
- `prev.getResponseCode()` → `response.status`
- JSON parsing: `JsonSlurper().parseText()` → `JSON.parse()`

---

#### 2.7.3 BeanShell PreProcessor

**JMeter:**
```xml
<BeanShellPreProcessor guiclass="TestBeanGUI" testclass="BeanShellPreProcessor" testname="Set Auth">
  <stringProp name="script">
    String username = vars.get("username");
    String password = vars.get("password");
    
    String credentials = username + ":" + password;
    String encoded = new String(Base64.getEncoder().encode(credentials.getBytes()));
    
    vars.put("auth_header", "Basic " + encoded);
  </stringProp>
</BeanShellPreProcessor>
```

**Relampo:**
```yaml
- request:
    name: "Authenticated Request"
    
    spark:
      - when: before
        script: |
          // Base64 encode credentials
          var username = vars.username;
          var password = vars.password;
          var credentials = username + ":" + password;
          var encoded = btoa(credentials);
          
          vars.auth_header = "Basic " + encoded;
    
    method: GET
    url: /api/protected
    headers:
      Authorization: "{{auth_header}}"
```

**Mapping:**
- BeanShell → JavaScript
- `Base64.getEncoder().encode()` → `btoa()` (Base64 encode)
- `Base64.getDecoder().decode()` → `atob()` (Base64 decode)

---

### 2.8 Timers

#### 2.8.1 Constant Timer

**JMeter:**
```xml
<ConstantTimer guiclass="ConstantTimerGui" testclass="ConstantTimer" testname="Wait 2s">
  <stringProp name="ConstantTimer.delay">2000</stringProp>
</ConstantTimer>
```

**Relampo:**
```yaml
- think_time: "2s"  # 2000ms → 2s
```

---

#### 2.8.2 Uniform Random Timer

**JMeter:**
```xml
<UniformRandomTimer guiclass="UniformRandomTimerGui" testclass="UniformRandomTimer" testname="Random Wait">
  <stringProp name="ConstantTimer.delay">1000</stringProp>
  <stringProp name="RandomTimer.range">2000</stringProp>
</UniformRandomTimer>
```

**Relampo:**
```yaml
- think_time:
    min: "1s"    # ConstantTimer.delay
    max: "3s"    # delay + range = 1000 + 2000 = 3000ms
    distribution: uniform
```

---

#### 2.8.3 Gaussian Random Timer

**JMeter:**
```xml
<GaussianRandomTimer guiclass="GaussianRandomTimerGui" testclass="GaussianRandomTimer" testname="Gaussian Wait">
  <stringProp name="ConstantTimer.delay">2000</stringProp>
  <stringProp name="RandomTimer.range">500</stringProp>
</GaussianRandomTimer>
```

**Relampo:**
```yaml
- think_time:
    mean: "2s"      # ConstantTimer.delay
    std_dev: "500ms"  # RandomTimer.range
    distribution: gaussian
```

---

### 2.9 Controllers

#### 2.9.1 Simple Controller

**JMeter:**
```xml
<GenericController guiclass="LogicControllerGui" testclass="GenericController" testname="User Flow">
  <hashTree>
    <!-- Child samplers here -->
  </hashTree>
</GenericController>
```

**Relampo:**
```yaml
- group:
    name: "User Flow"
    steps:
      # Child requests here
```

---

#### 2.9.2 Loop Controller

**JMeter:**
```xml
<LoopController guiclass="LoopControlPanel" testclass="LoopController" testname="Retry 3 Times">
  <intProp name="LoopController.loops">3</intProp>
  <boolProp name="LoopController.continue_forever">false</boolProp>
  <hashTree>
    <!-- Child samplers here -->
  </hashTree>
</LoopController>
```

**Relampo:**
```yaml
- loop: 3
  steps:
    # Child requests here
```

**Advanced form with break condition:**
```yaml
- loop:
    count: 3
    break_on: "vars.success === true"
  steps:
    - request:
        method: GET
        url: /api/status
        extract:
          success: 'jsonpath("$.success")'
```

---

#### 2.9.3 If Controller

**JMeter:**
```xml
<IfController guiclass="IfControllerPanel" testclass="IfController" testname="If Success">
  <stringProp name="IfController.condition">${__groovy(vars.get("status") == "success")}</stringProp>
  <boolProp name="IfController.evaluateAll">false</boolProp>
  <boolProp name="IfController.useExpression">true</boolProp>
  <hashTree>
    <!-- Conditional steps here -->
  </hashTree>
</IfController>
```

**Relampo:**
```yaml
- if: 'vars.status === "success"'
  steps:
    - request:
        method: GET
        url: /api/next-step
```

**Mapping:**
- JMeter condition expressions → JavaScript expressions
- `${__groovy(...)}` → JavaScript equivalent
- `vars.get("name")` → `vars.name`
- Groovy `==` → JavaScript `===`

**Supported operators:**
```javascript
// Comparison
vars.count > 10
vars.status === "active"
vars.enabled !== false

// Logical
vars.count > 5 && vars.count < 100
vars.role === "admin" || vars.role === "superuser"

// Existence checks
vars.token !== undefined
vars.user_id
```

---

#### 2.9.4 Transaction Controller

**JMeter:**
```xml
<TransactionController guiclass="TransactionControllerGui" testclass="TransactionController" testname="Login Transaction">
  <boolProp name="TransactionController.parent">true</boolProp>
  <boolProp name="TransactionController.includeTimers">false</boolProp>
  <hashTree>
    <!-- Transaction steps here -->
  </hashTree>
</TransactionController>
```

**Relampo:**
```yaml
- group:
    name: "Login Transaction"
    steps:
      # Transaction steps here
```

**Note:** Transactions in JMeter are primarily for reporting/timing. In Relampo, use `group` for logical organization. Timing is tracked per request automatically.

---

### 2.10 Thread Groups

#### JMeter Thread Group

**JMeter:**
```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="API Users">
  <intProp name="ThreadGroup.num_threads">50</intProp>
  <intProp name="ThreadGroup.ramp_time">60</intProp>
  <longProp name="ThreadGroup.duration">300</longProp>
  <longProp name="ThreadGroup.delay">0</longProp>
  <boolProp name="ThreadGroup.scheduler">true</boolProp>
  <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
  <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
    <intProp name="LoopController.loops">-1</intProp>
    <boolProp name="LoopController.continue_forever">false</boolProp>
  </elementProp>
</ThreadGroup>
```

**Relampo:**
```yaml
scenarios:
  - name: "API Users"
    load:
      type: constant
      users: 50          # num_threads
      duration: "5m"     # 300s
      ramp_up: "1m"      # 60s ramp_time
      iterations: -1     # infinite loops (-1)
    
    error_policy:
      on_error: continue  # on_sample_error
```

**Mapping:**
- `num_threads` → `load.users`
- `ramp_time` → `load.ramp_up` (convert seconds to duration)
- `duration` → `load.duration` (convert seconds to duration)
- `loops=-1` → `iterations: -1` (infinite)
- `loops=N` → `iterations: N`
- `on_sample_error` → `error_policy.on_error`

---

## 3. Code Conversion Rules

### 3.1 Variable Access

| JMeter (Groovy/BeanShell) | Relampo (JavaScript) |
|---------------------------|----------------------|
| `vars.get("name")` | `vars.name` |
| `vars.put("name", value)` | `vars.name = value` |
| `${varname}` | `{{varname}}` (in strings) |
| `vars.remove("name")` | `delete vars.name` |

### 3.2 Response Access (PostProcessors)

| JMeter | Relampo |
|--------|---------|
| `prev.getResponseDataAsString()` | `response.body` |
| `prev.getResponseCode()` | `response.status` |
| `prev.getTime()` | `response.duration_ms` |
| `prev.getResponseHeaders()` | `response.headers` |

### 3.3 JSON Operations

| JMeter (Groovy) | Relampo (JavaScript) |
|-----------------|----------------------|
| `new JsonSlurper().parseText(str)` | `JSON.parse(str)` |
| `JsonOutput.toJson(obj)` | `JSON.stringify(obj)` |

### 3.4 String Operations

| JMeter (Groovy/Java) | Relampo (JavaScript) |
|----------------------|----------------------|
| `str.toUpperCase()` | `str.toUpperCase()` |
| `str.toLowerCase()` | `str.toLowerCase()` |
| `str.contains("sub")` | `str.includes("sub")` |
| `str.substring(0, 5)` | `str.substring(0, 5)` |
| `str.replace("a", "b")` | `str.replace("a", "b")` |

### 3.5 Encoding

| JMeter (Java) | Relampo (JavaScript) |
|---------------|----------------------|
| `Base64.getEncoder().encode(bytes)` | `btoa(str)` |
| `Base64.getDecoder().decode(bytes)` | `atob(str)` |
| `URLEncoder.encode(str, "UTF-8")` | `encodeURIComponent(str)` |
| `URLDecoder.decode(str, "UTF-8")` | `decodeURIComponent(str)` |

### 3.6 Random Values

| JMeter (Groovy) | Relampo (JavaScript) |
|-----------------|----------------------|
| `new Random().nextInt(100)` | `Math.floor(Math.random() * 100)` |
| `UUID.randomUUID().toString()` | UUID generation via custom function |

### 3.7 Logging

| JMeter | Relampo |
|--------|---------|
| `log.info(msg)` | `console.log(msg)` |
| `log.error(msg)` | `console.error(msg)` |
| `log.warn(msg)` | `console.warn(msg)` |

---

## 4. Unsupported Components

The following JMeter components will be **ignored** during conversion (with optional warning comments in output):

### 4.1 Listeners
- View Results Tree
- Summary Report
- Graph Results
- Aggregate Report
- All other listeners

**Reason:** Relampo has built-in metrics collection and reporting. Listeners are JMeter-specific UI/reporting components.

### 4.2 Non-HTTP Samplers
- JDBC Request
- FTP Request
- SMTP Sampler
- JMS samplers
- TCP Sampler

**Reason:** Relampo v1 focuses on HTTP/REST API testing.

### 4.3 Advanced Controllers
- While Controller (partial support possible)
- ForEach Controller (no direct equivalent)
- Switch Controller
- Module Controller
- Include Controller
- Interleave Controller
- Throughput Controller

**Reason:** Limited or no equivalent in Relampo v1.

### 4.4 Other Components
- Test Fragments
- Non-Test Elements
- Workbench items
- Test Plan level listeners
- Custom plugins

---

## 5. Conversion Strategy

### 5.1 Algorithm Overview

```
1. Parse JMX XML structure
2. Extract Test Plan metadata → test section
3. Extract User Defined Variables → variables section
4. Extract CSV Data Set Configs → data_source section
5. Extract HTTP Defaults → http_defaults section
6. For each Thread Group:
   a. Create scenario
   b. Convert load config
   c. Extract Cookie/Cache managers
   d. Traverse hashTree recursively
   e. Convert samplers to requests
   f. Convert controllers to groups/loops/ifs
   g. Convert timers to think_time
   h. Attach extractors/assertions/pre-post processors to requests
7. Generate YAML with proper indentation
8. Add header comments with metadata
```

### 5.2 HashTree Traversal

JMeter uses `<hashTree>` to represent hierarchical test structure:

```xml
<jmeterTestPlan>
  <hashTree>
    <TestPlan>
      <hashTree>
        <ThreadGroup>
          <hashTree>
            <HTTPSampler/>
            <hashTree>
              <JSONPostProcessor/>
            </hashTree>
          </hashTree>
        </ThreadGroup>
      </hashTree>
    </TestPlan>
  </hashTree>
</jmeterTestPlan>
```

**Traversal rules:**
- Elements and their child hashTree appear in pairs
- Child hashTree contains config elements (headers, extractors, etc.) for parent sampler
- Recursively process each element + hashTree pair

### 5.3 Variable Interpolation

Convert JMeter variable syntax to Relampo:

```javascript
function convertVariables(str) {
  // ${var} → {{var}}
  return str.replace(/\$\{([^}]+)\}/g, '{{$1}}');
}
```

### 5.4 Code Translation (Groovy/BeanShell → JavaScript)

**Basic strategy:**
1. Identify variable operations: `vars.get/put` → `vars.name`
2. Identify response access: `prev.*` → `response.*`
3. Convert JSON: `JsonSlurper` → `JSON.parse`
4. Convert logging: `log.*` → `console.*`
5. Convert string methods (most are compatible)
6. Convert loops: `for (int i...)` → `for (let i...)`
7. Convert conditionals: `if (condition)` (mostly compatible)

**Challenges:**
- Complex Groovy closures → require manual inspection
- Java-specific APIs → need JavaScript equivalents
- Type differences (int/long/double vs. number)

**Recommendation:** For complex scripts, add a TODO comment and flag for manual review.

---

## 6. Output Format

### 6.1 YAML Structure

```yaml
# ============================================================================
# RELAMPO YAML - CONVERTED FROM JMETER TEST PLAN
# ============================================================================
# Original JMX: <filename>.jmx
# Conversion Date: YYYY-MM-DD HH:MM:SS
# Total Samplers Converted: N
# Note: Some JMeter components may not have direct equivalents in Relampo
# ============================================================================

test:
  name: "<TestPlan name>"
  description: "<TestPlan comments>"
  version: "1.0"

variables:
  var1: value1
  var2: value2

data_source:
  type: csv
  file: "path/to/file.csv"
  mode: shared
  strategy: sequential
  on_exhausted: recycle
  bind:
    column: varname

http_defaults:
  base_url: "https://example.com"
  timeout: "30s"
  follow_redirects: true
  headers:
    Accept: "application/json"
    User-Agent: "Relampo/1.0"

scenarios:
  - name: "<Thread Group name>"
    load:
      type: constant
      users: 50
      duration: "5m"
      ramp_up: "1m"
    
    cookies:
      mode: auto
      persist_across_iterations: true
    
    cache_manager:
      enabled: true
    
    steps:
      - group:
          name: "Login"
          steps:
            - request:
                name: "01 - Get Login Page"
                method: GET
                url: /login
                assert:
                  status: 200
            
            - think_time: "2s"
            
            - request:
                name: "02 - Submit Login"
                
                spark:
                  - when: before
                    script: |
                      // PreProcessor logic here
                      vars.timestamp = Date.now().toString();
                  
                  - when: after
                    script: |
                      // PostProcessor logic here
                      console.log("Login completed");
                
                method: POST
                url: /api/login
                headers:
                  Content-Type: "application/json"
                body: '{"user":"{{username}}","pass":"{{password}}"}'
                extract:
                  token: 'jsonpath("$.token")'
                assert:
                  status: 200
                  jsonpath:
                    "$.success": true
      
      - loop: 5
        steps:
          - request:
              method: GET
              url: /api/data
              headers:
                Authorization: "Bearer {{token}}"
      
      - if: 'vars.token !== undefined'
        steps:
          - request:
              method: POST
              url: /api/logout

metrics:
  enabled: true
```

### 6.2 Conversion Warnings

Add comments for unsupported or partially converted elements:

```yaml
# WARNING: While Controller not fully supported - converted to fixed loop
- loop: 100
  break_on: 'vars.done === true'
  steps:
    # ...

# WARNING: JDBC Sampler not supported - skipped
# Original: "Database Query" sampler

# WARNING: Complex Groovy script may need manual review
- request:
    spark:
      - when: before
        script: |
          // TODO: Review complex Groovy conversion
          // Original used Java-specific APIs
```

---

## 7. Implementation Checklist

### Phase 1: Core Components (Weeks 1-2)
- [x] Test Plan metadata extraction
- [x] User Defined Variables
- [ ] CSV Data Set Config
- [x] HTTP Defaults (ConfigTestElement)
- [x] HTTP Samplers (GET, POST, PUT, DELETE)
- [x] Header Manager
- [x] Cookie Manager
- [x] Cache Manager
- [ ] Basic extractors (JSON, Regex)
- [ ] Basic assertions (status, body)
- [x] Simple/Transaction/Loop Controllers
- [x] Timers (Constant, Uniform Random)

### Phase 2: Advanced Features (Weeks 3-4)
- [ ] JSR223 PreProcessor/PostProcessor with code conversion
- [ ] BeanShell PreProcessor/PostProcessor with code conversion
- [ ] XPath Extractor
- [ ] Boundary Extractor
- [ ] JSON Assertion
- [ ] Duration/Size Assertions
- [ ] If Controller with condition conversion
- [ ] Gaussian Random Timer
- [ ] Thread Group load configuration

### Phase 3: Edge Cases & Polish (Week 5)
- [ ] Complex nested controllers
- [ ] Multiple CSV files
- [ ] Variable interpolation in all contexts
- [ ] Error handling and validation
- [ ] Conversion warnings and comments
- [ ] Code quality checks (linting converted scripts)
- [ ] Documentation and examples

---

## 8. Testing Strategy

### 8.1 Unit Tests

Test individual component conversions:

```javascript
describe('JMX Converter', () => {
  test('converts User Defined Variables', () => {
    const jmx = `<Arguments>...</Arguments>`;
    const result = convertVariables(jmx);
    expect(result).toEqual({ var1: 'value1' });
  });
  
  test('converts JSR223 PreProcessor to spark before', () => {
    const jmx = `<JSR223PreProcessor>...</JSR223PreProcessor>`;
    const result = convertPreProcessor(jmx);
    expect(result.spark[0].when).toBe('before');
  });
});
```

### 8.2 Integration Tests

Test complete JMX file conversions:

```javascript
test('converts full JMeter test plan', () => {
  const jmx = fs.readFileSync('test.jmx', 'utf-8');
  const yaml = convertJMXToPulseYAML(jmx);
  
  const parsed = YAML.parse(yaml);
  expect(parsed.test.name).toBe('My Test Plan');
  expect(parsed.scenarios).toHaveLength(1);
  expect(parsed.scenarios[0].steps).toHaveLength(5);
});
```

### 8.3 Validation Tests

Validate generated YAML:

```javascript
test('generated YAML is valid Relampo format', () => {
  const yaml = convertJMXToPulseYAML(jmxContent);
  const parsed = YAML.parse(yaml);
  
  // Validate structure
  expect(parsed).toHaveProperty('test');
  expect(parsed).toHaveProperty('scenarios');
  expect(parsed.scenarios[0]).toHaveProperty('steps');
});
```

---

## 9. Examples

### 9.1 Simple API Test

**JMeter JMX:**
```xml
<jmeterTestPlan>
  <hashTree>
    <TestPlan testname="API Test">
      <hashTree>
        <ThreadGroup testname="Users">
          <intProp name="ThreadGroup.num_threads">10</intProp>
          <intProp name="ThreadGroup.ramp_time">30</intProp>
          <hashTree>
            <ConfigTestElement testname="HTTP Defaults">
              <stringProp name="HTTPSampler.domain">api.example.com</stringProp>
              <stringProp name="HTTPSampler.protocol">https</stringProp>
            </ConfigTestElement>
            <hashTree/>
            
            <HTTPSamplerProxy testname="Get Users">
              <stringProp name="HTTPSampler.path">/users</stringProp>
              <stringProp name="HTTPSampler.method">GET</stringProp>
            </HTTPSamplerProxy>
            <hashTree>
              <JSONPostProcessor testname="Extract ID">
                <stringProp name="JSONPostProcessor.referenceNames">user_id</stringProp>
                <stringProp name="JSONPostProcessor.jsonPathExprs">$[0].id</stringProp>
              </JSONPostProcessor>
              <hashTree/>
            </hashTree>
          </hashTree>
        </ThreadGroup>
      </hashTree>
    </TestPlan>
  </hashTree>
</jmeterTestPlan>
```

**Converted Relampo YAML:**
```yaml
test:
  name: "API Test"
  version: "1.0"

http_defaults:
  base_url: "https://api.example.com"
  timeout: "30s"

scenarios:
  - name: "Users"
    load:
      type: constant
      users: 10
      ramp_up: "30s"
    
    steps:
      - request:
          name: "Get Users"
          method: GET
          url: /users
          extract:
            user_id: 'jsonpath("$[0].id")'
```

### 9.2 Login with Variables and CSV

**JMeter (simplified):**
- CSV Data Set: users.csv (email, password)
- Variable: API_URL
- POST /login with credentials
- Extract token
- GET /profile with token

**Converted Relampo:**
```yaml
test:
  name: "Login Test"
  version: "1.0"

variables:
  API_URL: "https://api.example.com"

data_source:
  type: csv
  file: "users.csv"
  mode: per_vu
  strategy: sequential
  on_exhausted: recycle
  bind:
    email: email
    password: password

http_defaults:
  base_url: "{{API_URL}}"

scenarios:
  - name: "User Login Flow"
    load:
      users: 5
      duration: "2m"
    
    steps:
      - request:
          name: "Login"
          method: POST
          url: /login
          body: '{"email":"{{email}}","password":"{{password}}"}'
          extract:
            auth_token: 'jsonpath("$.token")'
          assert:
            status: 200
      
      - request:
          name: "Get Profile"
          method: GET
          url: /profile
          headers:
            Authorization: "Bearer {{auth_token}}"
          assert:
            status: 200
```

---

## 10. Future Enhancements

### 10.1 Advanced Features
- Support for distributed testing parameters
- Advanced correlation (auto-detect dynamic values)
- Performance comparison (JMeter results vs. Relampo)

### 10.2 Code Intelligence
- AST-based Groovy → JavaScript conversion
- Type inference and validation
- Automatic variable dependency resolution

### 10.3 UI Improvements
- Visual diff of JMX vs. YAML
- Interactive mapping editor
- Conversion preview with warnings

---

## 11. References

- [Apache JMeter Documentation](https://jmeter.apache.org/usermanual/)
- [Relampo YAML Specification](./YAML_VALIDATOR_SPEC.md)
- [JMeter Test Plan XML Schema](https://jmeter.apache.org/usermanual/test_plan.html)
- [JavaScript Reference (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

**Document End**
