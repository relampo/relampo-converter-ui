# Especificación de Conversión JMX/Postman a Relampo YAML

**Versión del Documento:** 2.0  
**Fecha:** 2026-02-11  
**Estado:** Borrador

## 1. Descripción General

Este documento define el mapeo completo entre los componentes de planes de prueba de Apache JMeter (archivos .jmx) y colecciones Postman (archivos .json) hacia el formato YAML de Relampo. El conversor extrae los elementos soportados y los transforma en construcciones equivalentes de Relampo mientras mantiene la lógica y comportamiento de las pruebas.

### 1.1 Objetivos

- Permitir la migración fluida desde JMeter y Postman a Relampo
- Preservar la lógica de prueba, control de flujo y operaciones de datos
- Convertir solo los componentes soportados (ignorar plugins/listeners no soportados)
- Generar YAML de Relampo limpio y legible con estructura apropiada
- Proporcionar estadísticas detalladas de conversión
- Identificar y reportar elementos no soportados de forma categorizada

### 1.2 Alcance

**EN ALCANCE:**
- Samplers HTTP y elementos de configuración
- Fuentes de datos (CSV Data Set Config)
- Variables (User Defined Variables)
- Pre/Post procesadores (JSR223, BeanShell)
- Extractores (JSON, Regex, XPath, Boundary)
- Aserciones (Response, JSON, Duration, Size)
- Controladores (Simple, Loop, If, Transaction)
- Temporizadores (Constant, Uniform Random, Gaussian)
- Administradores (Cookie, Cache, Header, HTTP Defaults)

**FUERA DE ALCANCE:**
- Listeners (View Results Tree, Graph Results, Summary Report, etc.)
- Samplers no-HTTP (JDBC, FTP, SMTP, JMS, etc.)
- Controladores avanzados (While, ForEach, Switch - soporte parcial)
- Plugins de JMeter y componentes personalizados
- Configuración de Thread Group (convertido a config de carga de escenario)

---

## 2. Referencia de Mapeo de Componentes

### 2.1 Estructura del Plan de Prueba

#### JMeter TestPlan
```xml
<TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Mi Plan de Prueba">
  <stringProp name="TestPlan.comments">Descripción de la prueba</stringProp>
  <boolProp name="TestPlan.functional_mode">false</boolProp>
  <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
  <elementProp name="TestPlan.user_defined_variables">
    <!-- Variables aquí -->
  </elementProp>
</TestPlan>
```

#### Relampo YAML
```yaml
test:
  name: "Mi Plan de Prueba"
  description: "Descripción de la prueba"
  version: "1.0"

variables:
  # Variables definidas por usuario aquí
```

**Mapeo:**
- `testname` → `test.name`
- `TestPlan.comments` → `test.description`
- Versión establecida a "1.0" por defecto

---

### 2.2 Variables y Fuentes de Datos

#### 2.2.1 Variables Definidas por Usuario

**JMeter:**
```xml
<Arguments guiclass="ArgumentsPanel" testclass="Arguments" testname="Variables Definidas">
  <collectionProp name="Arguments.arguments">
    <elementProp name="BASE_URL" elementType="Argument">
      <stringProp name="Argument.name">BASE_URL</stringProp>
      <stringProp name="Argument.value">https://api.ejemplo.com</stringProp>
    </elementProp>
    <elementProp name="API_KEY" elementType="Argument">
      <stringProp name="Argument.name">API_KEY</stringProp>
      <stringProp name="Argument.value">secreto123</stringProp>
    </elementProp>
  </collectionProp>
</Arguments>
```

**Relampo:**
```yaml
variables:
  BASE_URL: "https://api.ejemplo.com"
  API_KEY: "secreto123"
```

---

#### 2.2.2 Configuración de Dataset CSV

**JMeter:**
```xml
<CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="Usuarios CSV">
  <stringProp name="filename">datos/usuarios.csv</stringProp>
  <stringProp name="fileEncoding">UTF-8</stringProp>
  <stringProp name="variableNames">email,password,nombre</stringProp>
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
  file: "datos/usuarios.csv"
  mode: shared  # shareMode.all → shared, shareMode.group → per_vu
  strategy: sequential
  on_exhausted: recycle  # recycle=true → recycle, stopThread=true → stop
  bind:
    email: email
    password: password
    nombre: nombre
```

**Reglas de Mapeo:**
- `shareMode.all` → `mode: shared`
- `shareMode.group` o `shareMode.thread` → `mode: per_vu`
- `recycle=true` → `on_exhausted: recycle`
- `stopThread=true` → `on_exhausted: stop`
- `variableNames` → `bind` (nombre_columna: nombre_var)
- Si `variableNames` está vacío, usar la fila de encabezado del CSV como nombres de variables

**Ubicación:**
- Nivel raíz `data_source` para acceso CSV global
- Nivel de request `data_source` para iteración CSV por petición

---

### 2.3 Configuración HTTP

#### 2.3.1 HTTP Request Defaults (ConfigTestElement)

**JMeter:**
```xml
<ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="Valores HTTP por Defecto">
  <stringProp name="HTTPSampler.domain">api.ejemplo.com</stringProp>
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
  base_url: "https://api.ejemplo.com"
  timeout: "30s"
  follow_redirects: true
  headers:
    Accept: "application/json"
    User-Agent: "Relampo/1.0"
```

**Mapeo:**
- `protocol://domain:port` → `base_url`
- `response_timeout` → `timeout` (convertir ms a string de duración)
- `follow_redirects` → `follow_redirects`
- Headers por defecto agregados automáticamente

---

#### 2.3.2 Administrador de Headers HTTP

**JMeter:**
```xml
<HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Headers HTTP">
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
# Nivel global (si está adjunto al Test Plan o Thread Group)
http_defaults:
  headers:
    Authorization: "Bearer {{token}}"
    Content-Type: "application/json"

# Nivel de request (si está adjunto a un sampler específico)
- request:
    method: POST
    url: /api/usuarios
    headers:
      Authorization: "Bearer {{token}}"
      Content-Type: "application/json"
```

**Mapeo:**
- Variables JMeter `${varname}` → Relampo `{{varname}}`
- Headers a nivel Test Plan → `http_defaults.headers`
- Headers a nivel sampler → `request.headers`

---

#### 2.3.3 Administrador de Cookies HTTP

**JMeter:**
```xml
<CookieManager guiclass="CookiePanel" testclass="CookieManager" testname="Administrador de Cookies">
  <boolProp name="CookieManager.clearEachIteration">false</boolProp>
  <stringProp name="CookieManager.policy">default</stringProp>
</CookieManager>
```

**Relampo:**
```yaml
scenarios:
  - name: "Mi Escenario"
    cookies:
      mode: auto
      persist_across_iterations: true  # clearEachIteration=false
```

**Mapeo:**
- Cookie Manager presente → `cookies.mode: auto`
- `clearEachIteration=false` → `persist_across_iterations: true`
- `clearEachIteration=true` → `persist_across_iterations: false`

---

#### 2.3.4 Administrador de Caché HTTP

**JMeter:**
```xml
<CacheManager guiclass="CacheManagerGui" testclass="CacheManager" testname="Administrador de Caché">
  <boolProp name="clearEachIteration">false</boolProp>
  <boolProp name="useExpires">true</boolProp>
</CacheManager>
```

**Relampo:**
```yaml
scenarios:
  - name: "Mi Escenario"
    cache_manager:
      enabled: true
      clear_each_iteration: false
```

---

### 2.4 Samplers HTTP

#### 2.4.1 HTTP Request Sampler (HTTPSamplerProxy)

**JMeter:**
```xml
<HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="GET Usuarios">
  <stringProp name="HTTPSampler.domain">api.ejemplo.com</stringProp>
  <stringProp name="HTTPSampler.port">443</stringProp>
  <stringProp name="HTTPSampler.protocol">https</stringProp>
  <stringProp name="HTTPSampler.path">/api/v1/usuarios</stringProp>
  <stringProp name="HTTPSampler.method">GET</stringProp>
  <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
  <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
    <collectionProp name="Arguments.arguments">
      <elementProp name="pagina" elementType="HTTPArgument">
        <stringProp name="Argument.name">pagina</stringProp>
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
    name: "GET Usuarios"
    method: GET
    url: /api/v1/usuarios
    query_params:
      pagina: "1"
```

**Mapeo:**
- `testname` → `name`
- `HTTPSampler.method` → `method`
- `HTTPSampler.path` → `url` (relativo si base_url está definido)
- Argumentos de query string → `query_params`
- Argumentos de body (POST) → `body` (URL-encoded o raw)
- `protocol://domain:port` extraído como `base_url` si no está en http_defaults

---

#### 2.4.2 Petición POST con Body

**JMeter:**
```xml
<HTTPSamplerProxy testname="Crear Usuario" testclass="HTTPSamplerProxy">
  <stringProp name="HTTPSampler.path">/api/v1/usuarios</stringProp>
  <stringProp name="HTTPSampler.method">POST</stringProp>
  <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
  <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
    <collectionProp name="Arguments.arguments">
      <elementProp name="" elementType="HTTPArgument">
        <stringProp name="Argument.value">{"nombre":"${username}","email":"${email}"}</stringProp>
        <boolProp name="HTTPArgument.always_encode">false</boolProp>
      </elementProp>
    </collectionProp>
  </elementProp>
</HTTPSamplerProxy>
```

**Relampo:**
```yaml
- request:
    name: "Crear Usuario"
    method: POST
    url: /api/v1/usuarios
    headers:
      Content-Type: "application/json"
    body: '{"nombre":"{{username}}","email":"{{email}}"}'
```

**Mapeo:**
- `postBodyRaw=true` → body como string raw
- `postBodyRaw=false` → body como parámetros URL-encoded
- JMeter `${var}` → Relampo `{{var}}`

---

### 2.5 Extractores

#### 2.5.1 Extractor JSON

**JMeter:**
```xml
<JSONPostProcessor guiclass="JSONPostProcessorGui" testclass="JSONPostProcessor" testname="Extraer Token">
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
      # O con valor por defecto:
      # auth_token: "jsonpath(\"$.data.token\") || \"NOTFOUND\""
```

**Mapeo:**
- `referenceNames` → nombre de variable en el mapa extract
- `jsonPathExprs` → `jsonpath("expresion")`
- `defaultValues` → fallback usando `|| "default"`
- `match_numbers` → índice en JSONPath (por defecto: primer match)

---

#### 2.5.2 Extractor de Expresión Regular

**JMeter:**
```xml
<RegexExtractor guiclass="RegexExtractorGui" testclass="RegexExtractor" testname="Extraer User ID">
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
    url: /api/usuario
    extract:
      user_id: 'regex("\"id\":(\\d+)")'
      # Con valor por defecto:
      # user_id: 'regex("\"id\":(\\d+)") || "0"'
```

**Mapeo:**
- `refname` → nombre de variable
- `regex` → `regex("patron")`
- `template` → grupo capturado (por defecto: $1$)
- `default` → fallback usando `|| "valor"`
- Escapar backslashes apropiadamente en YAML

---

#### 2.5.3 Extractor XPath

**JMeter:**
```xml
<XPathExtractor guiclass="XPathExtractorGui" testclass="XPathExtractor" testname="Extraer Título">
  <stringProp name="XPathExtractor.refname">page_title</stringProp>
  <stringProp name="XPathExtractor.xpathQuery">//title/text()</stringProp>
  <stringProp name="XPathExtractor.default">Sin Título</stringProp>
  <boolProp name="XPathExtractor.validate">false</boolProp>
  <boolProp name="XPathExtractor.tolerant">true</boolProp>
</XPathExtractor>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /pagina.html
    extract:
      page_title: 'xpath("//title/text()") || "Sin Título"'
```

---

### 2.6 Aserciones

#### 2.6.1 Aserción de Respuesta

**JMeter:**
```xml
<ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Verificar Éxito">
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
      # O para el body de respuesta:
      # body_contains: "exito"
      # body_matches: "patron regex"
```

**Mapeo:**
- Test de `response_code` → `assert.status`
- `response_data` contiene → `assert.body_contains`
- `response_data` coincide → `assert.body_matches`
- `response_headers` → `assert.header_contains` o assert personalizado

**Tipos de Test:**
- `test_type=8` (equals) → coincidencia exacta
- `test_type=16` (contains) → sufijo `_contains`
- `test_type=2` (matches) → sufijo `_matches`

---

#### 2.6.2 Aserción JSON

**JMeter:**
```xml
<JSONPathAssertion guiclass="JSONPathAssertionGui" testclass="JSONPathAssertion" testname="Verificar Estado">
  <stringProp name="JSON_PATH">$.status</stringProp>
  <stringProp name="EXPECTED_VALUE">exito</stringProp>
  <boolProp name="JSONVALIDATION">true</boolProp>
  <boolProp name="EXPECT_NULL">false</boolProp>
  <boolProp name="INVERT">false</boolProp>
</JSONPathAssertion>
```

**Relampo:**
```yaml
- request:
    method: POST
    url: /api/accion
    assert:
      jsonpath:
        "$.status": "exito"
        "$.code": 200
```

---

#### 2.6.3 Aserción de Duración

**JMeter:**
```xml
<DurationAssertion guiclass="DurationAssertionGui" testclass="DurationAssertion" testname="Verificar Rápido">
  <stringProp name="DurationAssertion.duration">2000</stringProp>
</DurationAssertion>
```

**Relampo:**
```yaml
- request:
    method: GET
    url: /api/rapido
    assert:
      response_time_max: "2s"  # 2000ms → 2s
```

---

### 2.7 Pre/Post Procesadores

#### 2.7.1 JSR223 PreProcessor

**JMeter:**
```xml
<JSR223PreProcessor guiclass="TestBeanGUI" testclass="JSR223PreProcessor" testname="Configurar Variables">
  <stringProp name="scriptLanguage">groovy</stringProp>
  <stringProp name="script">
    import java.util.UUID
    
    def requestId = UUID.randomUUID().toString()
    vars.put("request_id", requestId)
    
    def timestamp = System.currentTimeMillis().toString()
    vars.put("timestamp", timestamp)
    
    log.info("ID de petición generado: " + requestId)
  </stringProp>
</JSR223PreProcessor>
```

**Relampo:**
```yaml
- request:
    name: "Llamada API"
    
    spark:
      - when: before
        script: |
          // Generar ID único de petición
          vars.request_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            var v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          
          // Timestamp actual
          vars.timestamp = Date.now().toString();
          
          console.log("ID de petición generado: " + vars.request_id);
    
    method: GET
    url: /api/endpoint
    headers:
      X-Request-ID: "{{request_id}}"
      X-Timestamp: "{{timestamp}}"
```

**Mapeo:**
- JSR223PreProcessor → `spark` con `when: before`
- Código Groovy/Java → equivalente JavaScript
- `vars.put("name", value)` → `vars.name = value`
- `vars.get("name")` → `vars.name`
- `log.info(msg)` → `console.log(msg)`

---

#### 2.7.2 JSR223 PostProcessor

**JMeter:**
```xml
<JSR223PostProcessor guiclass="TestBeanGUI" testclass="JSR223PostProcessor" testname="Validar Respuesta">
  <stringProp name="scriptLanguage">groovy</stringProp>
  <stringProp name="script">
    import groovy.json.JsonSlurper
    
    def response = prev.getResponseDataAsString()
    def json = new JsonSlurper().parseText(response)
    
    if (json.status != "exito") {
      log.error("Petición falló con estado: " + json.status)
    } else {
      log.info("Petición exitosa")
      vars.put("user_id", json.data.id.toString())
    }
    
    vars.put("response_time", prev.getTime().toString())
  </stringProp>
</JSR223PostProcessor>
```

**Relampo:**
```yaml
- request:
    name: "Crear Usuario"
    method: POST
    url: /api/usuarios
    body: '{"nombre":"Juan"}'
    
    spark:
      - when: after
        script: |
          // Parsear respuesta JSON
          var json = JSON.parse(response.body);
          
          if (json.status !== "exito") {
            console.error("Petición falló con estado: " + json.status);
          } else {
            console.log("Petición exitosa");
            vars.user_id = json.data.id.toString();
          }
          
          vars.response_time = response.duration_ms.toString();
```

**Mapeo:**
- JSR223PostProcessor → `spark` con `when: after`
- `prev.getResponseDataAsString()` → `response.body`
- `prev.getTime()` → `response.duration_ms`
- `prev.getResponseCode()` → `response.status`
- Parseo JSON: `JsonSlurper().parseText()` → `JSON.parse()`

---

#### 2.7.3 BeanShell PreProcessor

**JMeter:**
```xml
<BeanShellPreProcessor guiclass="TestBeanGUI" testclass="BeanShellPreProcessor" testname="Configurar Auth">
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
    name: "Petición Autenticada"
    
    spark:
      - when: before
        script: |
          // Codificar credenciales en Base64
          var username = vars.username;
          var password = vars.password;
          var credentials = username + ":" + password;
          var encoded = btoa(credentials);
          
          vars.auth_header = "Basic " + encoded;
    
    method: GET
    url: /api/protegido
    headers:
      Authorization: "{{auth_header}}"
```

**Mapeo:**
- BeanShell → JavaScript
- `Base64.getEncoder().encode()` → `btoa()` (codificar Base64)
- `Base64.getDecoder().decode()` → `atob()` (decodificar Base64)

---

### 2.8 Temporizadores

#### 2.8.1 Temporizador Constante

**JMeter:**
```xml
<ConstantTimer guiclass="ConstantTimerGui" testclass="ConstantTimer" testname="Esperar 2s">
  <stringProp name="ConstantTimer.delay">2000</stringProp>
</ConstantTimer>
```

**Relampo:**
```yaml
- think_time: "2s"  # 2000ms → 2s
```

---

#### 2.8.2 Temporizador Aleatorio Uniforme

**JMeter:**
```xml
<UniformRandomTimer guiclass="UniformRandomTimerGui" testclass="UniformRandomTimer" testname="Espera Aleatoria">
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

#### 2.8.3 Temporizador Aleatorio Gaussiano

**JMeter:**
```xml
<GaussianRandomTimer guiclass="GaussianRandomTimerGui" testclass="GaussianRandomTimer" testname="Espera Gaussiana">
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

### 2.9 Controladores

#### 2.9.1 Controlador Simple

**JMeter:**
```xml
<GenericController guiclass="LogicControllerGui" testclass="GenericController" testname="Flujo de Usuario">
  <hashTree>
    <!-- Samplers hijos aquí -->
  </hashTree>
</GenericController>
```

**Relampo:**
```yaml
- group:
    name: "Flujo de Usuario"
    steps:
      # Peticiones hijas aquí
```

---

#### 2.9.2 Controlador de Loop

**JMeter:**
```xml
<LoopController guiclass="LoopControlPanel" testclass="LoopController" testname="Reintentar 3 Veces">
  <intProp name="LoopController.loops">3</intProp>
  <boolProp name="LoopController.continue_forever">false</boolProp>
  <hashTree>
    <!-- Samplers hijos aquí -->
  </hashTree>
</LoopController>
```

**Relampo:**
```yaml
- loop: 3
  steps:
    # Peticiones hijas aquí
```

**Forma avanzada con condición de ruptura:**
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

#### 2.9.3 Controlador If

**JMeter:**
```xml
<IfController guiclass="IfControllerPanel" testclass="IfController" testname="Si Éxito">
  <stringProp name="IfController.condition">${__groovy(vars.get("status") == "exito")}</stringProp>
  <boolProp name="IfController.evaluateAll">false</boolProp>
  <boolProp name="IfController.useExpression">true</boolProp>
  <hashTree>
    <!-- Pasos condicionales aquí -->
  </hashTree>
</IfController>
```

**Relampo:**
```yaml
- if: 'vars.status === "exito"'
  steps:
    - request:
        method: GET
        url: /api/siguiente-paso
```

**Mapeo:**
- Expresiones de condición JMeter → expresiones JavaScript
- `${__groovy(...)}` → equivalente JavaScript
- `vars.get("name")` → `vars.name`
- Groovy `==` → JavaScript `===`

**Operadores soportados:**
```javascript
// Comparación
vars.contador > 10
vars.status === "activo"
vars.habilitado !== false

// Lógicos
vars.contador > 5 && vars.contador < 100
vars.rol === "admin" || vars.rol === "superusuario"

// Verificaciones de existencia
vars.token !== undefined
vars.user_id
```

---

#### 2.9.4 Controlador de Transacción

**JMeter:**
```xml
<TransactionController guiclass="TransactionControllerGui" testclass="TransactionController" testname="Transacción Login">
  <boolProp name="TransactionController.parent">true</boolProp>
  <boolProp name="TransactionController.includeTimers">false</boolProp>
  <hashTree>
    <!-- Pasos de transacción aquí -->
  </hashTree>
</TransactionController>
```

**Relampo:**
```yaml
- group:
    name: "Transacción Login"
    steps:
      # Pasos de transacción aquí
```

**Nota:** Las transacciones en JMeter son principalmente para reportes/tiempo. En Relampo, usa `group` para organización lógica. El tiempo se rastrea automáticamente por petición.

---

### 2.10 Thread Groups

#### JMeter Thread Group

**JMeter:**
```xml
<ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Usuarios API">
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
  - name: "Usuarios API"
    load:
      type: constant
      users: 50          # num_threads
      duration: "5m"     # 300s
      ramp_up: "1m"      # 60s ramp_time
      iterations: -1     # loops infinitos (-1)
    
    error_policy:
      on_error: continue  # on_sample_error
```

**Mapeo:**
- `num_threads` → `load.users`
- `ramp_time` → `load.ramp_up` (convertir segundos a duración)
- `duration` → `load.duration` (convertir segundos a duración)
- `loops=-1` → `iterations: -1` (infinito)
- `loops=N` → `iterations: N`
- `on_sample_error` → `error_policy.on_error`

---

## 3. Reglas de Conversión de Código

### 3.1 Acceso a Variables

| JMeter (Groovy/BeanShell) | Relampo (JavaScript) |
|---------------------------|----------------------|
| `vars.get("name")` | `vars.name` |
| `vars.put("name", value)` | `vars.name = value` |
| `${varname}` | `{{varname}}` (en strings) |
| `vars.remove("name")` | `delete vars.name` |

### 3.2 Acceso a Respuesta (PostProcessors)

| JMeter | Relampo |
|--------|---------|
| `prev.getResponseDataAsString()` | `response.body` |
| `prev.getResponseCode()` | `response.status` |
| `prev.getTime()` | `response.duration_ms` |
| `prev.getResponseHeaders()` | `response.headers` |

### 3.3 Operaciones JSON

| JMeter (Groovy) | Relampo (JavaScript) |
|-----------------|----------------------|
| `new JsonSlurper().parseText(str)` | `JSON.parse(str)` |
| `JsonOutput.toJson(obj)` | `JSON.stringify(obj)` |

### 3.4 Operaciones de String

| JMeter (Groovy/Java) | Relampo (JavaScript) |
|----------------------|----------------------|
| `str.toUpperCase()` | `str.toUpperCase()` |
| `str.toLowerCase()` | `str.toLowerCase()` |
| `str.contains("sub")` | `str.includes("sub")` |
| `str.substring(0, 5)` | `str.substring(0, 5)` |
| `str.replace("a", "b")` | `str.replace("a", "b")` |

### 3.5 Codificación

| JMeter (Java) | Relampo (JavaScript) |
|---------------|----------------------|
| `Base64.getEncoder().encode(bytes)` | `btoa(str)` |
| `Base64.getDecoder().decode(bytes)` | `atob(str)` |
| `URLEncoder.encode(str, "UTF-8")` | `encodeURIComponent(str)` |
| `URLDecoder.decode(str, "UTF-8")` | `decodeURIComponent(str)` |

### 3.6 Valores Aleatorios

| JMeter (Groovy) | Relampo (JavaScript) |
|-----------------|----------------------|
| `new Random().nextInt(100)` | `Math.floor(Math.random() * 100)` |
| `UUID.randomUUID().toString()` | Generación UUID vía función personalizada |

### 3.7 Logging

| JMeter | Relampo |
|--------|---------|
| `log.info(msg)` | `console.log(msg)` |
| `log.error(msg)` | `console.error(msg)` |
| `log.warn(msg)` | `console.warn(msg)` |

---

## 4. Componentes No Soportados

Los siguientes componentes de JMeter serán **ignorados** durante la conversión (con comentarios de advertencia opcionales en la salida):

### 4.1 Listeners
- View Results Tree
- Summary Report
- Graph Results
- Aggregate Report
- Todos los demás listeners

**Razón:** Relampo tiene colección de métricas y reportes integrados. Los listeners son componentes UI/reportes específicos de JMeter.

### 4.2 Samplers No-HTTP
- JDBC Request
- FTP Request
- SMTP Sampler
- Samplers JMS
- TCP Sampler

**Razón:** Relampo v1 se enfoca en pruebas HTTP/REST API.

### 4.3 Controladores Avanzados
- While Controller (soporte parcial posible)
- ForEach Controller (sin equivalente directo)
- Switch Controller
- Module Controller
- Include Controller
- Interleave Controller
- Throughput Controller

**Razón:** Equivalente limitado o inexistente en Relampo v1.

### 4.4 Otros Componentes
- Test Fragments
- Non-Test Elements
- Elementos del Workbench
- Listeners a nivel Test Plan
- Plugins personalizados

---

## 5. Estrategia de Conversión

### 5.1 Resumen del Algoritmo

```
1. Parsear estructura XML del JMX
2. Extraer metadata del Test Plan → sección test
3. Extraer Variables Definidas por Usuario → sección variables
4. Extraer CSV Data Set Configs → sección data_source
5. Extraer HTTP Defaults → sección http_defaults
6. Para cada Thread Group:
   a. Crear escenario
   b. Convertir config de carga
   c. Extraer administradores Cookie/Cache
   d. Recorrer hashTree recursivamente
   e. Convertir samplers a requests
   f. Convertir controladores a groups/loops/ifs
   g. Convertir timers a think_time
   h. Adjuntar extractores/aserciones/pre-post procesadores a requests
7. Generar YAML con indentación apropiada
8. Agregar comentarios de encabezado con metadata
```

### 5.2 Recorrido de HashTree

JMeter usa `<hashTree>` para representar estructura jerárquica de prueba:

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

**Reglas de recorrido:**
- Elementos y su hashTree hijo aparecen en pares
- El hashTree hijo contiene elementos de configuración (headers, extractores, etc.) para el sampler padre
- Procesar recursivamente cada par elemento + hashTree

### 5.3 Interpolación de Variables

Convertir sintaxis de variables JMeter a Relampo:

```javascript
function convertVariables(str) {
  // ${var} → {{var}}
  return str.replace(/\$\{([^}]+)\}/g, '{{$1}}');
}
```

### 5.4 Traducción de Código (Groovy/BeanShell → JavaScript)

**Estrategia básica:**
1. Identificar operaciones de variables: `vars.get/put` → `vars.name`
2. Identificar acceso a respuesta: `prev.*` → `response.*`
3. Convertir JSON: `JsonSlurper` → `JSON.parse`
4. Convertir logging: `log.*` → `console.*`
5. Convertir métodos string (la mayoría son compatibles)
6. Convertir loops: `for (int i...)` → `for (let i...)`
7. Convertir condicionales: `if (condition)` (mayormente compatible)

**Desafíos:**
- Closures complejos de Groovy → requieren inspección manual
- APIs específicas de Java → necesitan equivalentes JavaScript
- Diferencias de tipos (int/long/double vs. number)

**Recomendación:** Para scripts complejos, agregar un comentario TODO y marcar para revisión manual.

---

## 6. Formato de Salida

### 6.1 Estructura YAML con Estadísticas

#### JMeter Header
```yaml
# ============================================================================
# RELAMPO YAML - CONVERTIDO DESDE PLAN DE PRUEBA JMETER
# ============================================================================
# Fecha de Conversión: 2026-02-11 22:15:00
#
# CONVERSION STATS:
# - HTTP Requests: 16
# - Extractors: 2
# - Assertions: 1
# - Spark Scripts: 3
# - User Variables: 1
# - CSV Data Sources: 1
# - Timers: 3
# - Controllers: 3
# ============================================================================
#
# ⚠️  UNSUPPORTED ELEMENTS (not converted):
#   - XMLSchemaAssertion "XML Schema Assertion" - Not supported in Relampo
#   - SizeAssertion "Size Assertion" - Not supported in Relampo
#   - JSR223Timer "JSR223 Timer" - Not supported in Relampo
#   - ResultCollector "View Results Tree" - Not supported in Relampo
# ============================================================================

test:
  name: "<nombre TestPlan>"
  description: "<comentarios TestPlan>"
  version: "1.0"

variables:
  var1: valor1
  var2: valor2

data_source:
  type: csv
  file: "ruta/al/archivo.csv"
  mode: shared
  strategy: sequential
  on_exhausted: recycle
  bind:
    columna: nombrevar

http_defaults:
  base_url: "https://ejemplo.com"
  timeout: "30s"
  follow_redirects: true
  headers:
    Accept: "application/json"
    User-Agent: "Relampo/1.0"

scenarios:
  - name: "<nombre Thread Group>"
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
                name: "01 - Obtener Página Login"
                method: GET
                url: /login
                assert:
                  status: 200
            
            - think_time: "2s"
            
            - request:
                name: "02 - Enviar Login"
                
                spark:
                  - when: before
                    script: |
                      // Lógica de PreProcessor aquí
                      vars.timestamp = Date.now().toString();
                  
                  - when: after
                    script: |
                      // Lógica de PostProcessor aquí
                      console.log("Login completado");
                
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
              url: /api/datos
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

#### Postman Header
```yaml
# ============================================================================
# RELAMPO YAML - CONVERTIDO DESDE COLECCIÓN POSTMAN
# ============================================================================
# Fecha de Conversión: 2026-02-11 22:15:00
# Collection: My API Tests
#
# CONVERSION STATS:
# - HTTP Requests: 85
# - Folders/Groups: 5
# - Extractors: 42
#
# LIMITATIONS (not converted):
# - Collection variables not auto-converted
# - Authentication for 15 requests
# - Pre-request scripts for 76 requests
# - Test scripts for 113 requests
# ============================================================================
```

**Estadísticas Incluidas:**

**JMeter:**
- HTTP Requests (solo habilitados)
- Extractors (JSON, Regex, XPath)
- Assertions (Response, JSON, Duration)
- Spark Scripts (JSR223/BeanShell Pre/PostProcessors)
- User Variables
- CSV Data Sources
- Timers (Constant, Uniform, Gaussian)
- Controllers (If, Loop, Generic, Simple)

**Postman:**
- HTTP Requests
- Folders/Groups
- Extractors (de test scripts)
- Limitations categorizadas (auth, scripts, etc.)

### 6.2 Sistema de Detección de Elementos No Soportados

**Categorías Detectadas:**

1. **Listeners** (JMeter)
   - ResultCollector, ViewResultsFullVisualizer, SummaryReport, etc.
   
2. **Samplers No-HTTP** (JMeter)
   - JDBCSampler, FTPSampler, SMTPSampler, etc.
   
3. **Controladores Avanzados** (JMeter)
   - WhileController, ForeachController, SwitchController, etc.
   
4. **Assertions No Soportadas** (JMeter)
   - XMLSchemaAssertion, SizeAssertion, HTMLAssertion, etc.
   
5. **Timers No Soportados** (JMeter)
   - JSR223Timer, BeanShellTimer, PoissonRandomTimer, etc.
   
6. **Postman Limitations**
   - Collection-level authentication
   - Collection variables
   - Pre-request scripts (conteo)
   - Complex test scripts (conteo)
   - Request-level authentication (conteo)

**Ejemplo de Output:**
```yaml
# ⚠️  UNSUPPORTED ELEMENTS (not converted):
#   - XMLSchemaAssertion "XML Schema Assertion" - Not supported in Relampo
#   - JSR223Timer "Custom Timer" - Not supported in Relampo
#   - ResultCollector "View Results Tree" - Not supported in Relampo
```

---

## 7. Conversión de Postman JSON

### 7.1 Descripción General

Las colecciones Postman (.json) contienen requests HTTP organizados en carpetas, con soporte para pre-request scripts, test scripts, y extracción de variables. El conversor transforma estos elementos en el formato YAML de Relampo.

### 7.2 Estructura de Colección Postman

**Postman Collection:**
```json
{
  "info": {
    "name": "Mi API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"test@example.com\",\"password\":\"pass123\"}"
        },
        "url": {
          "raw": "https://api.example.com/auth/login",
          "protocol": "https",
          "host": ["api", "example", "com"],
          "path": ["auth", "login"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.environment.set(\"token\", pm.response.json().token);"
            ]
          }
        }
      ]
    }
  ]
}
```

**Relampo YAML:**
```yaml
test:
  name: "Mi API Tests"
  description: "Imported from Postman collection"
  version: "1.0"

variables:
  base_url: "https://api.example.com"

http_defaults:
  base_url: "{{base_url}}"
  timeout: "10s"
  headers:
    Accept: "application/json"
    User-Agent: "Relampo-Test"

scenarios:
  - name: "Imported Scenario"
    load:
      users: 1
      duration: "1m"
      ramp_up: "0s"
    cookies: auto
    steps:
      - request:
          name: "Login"
          method: POST
          url: /auth/login
          headers:
            Content-Type: "application/json"
          body: '{"email":"test@example.com","password":"pass123"}'
          extract:
            token: 'jsonpath("$.token")'

metrics:
  enabled: true
```

### 7.3 Mapeo de Elementos Postman

#### 7.3.1 Request Headers

**Postman:**
```json
"header": [
  {
    "key": "Authorization",
    "value": "Bearer {{token}}",
    "disabled": false
  },
  {
    "key": "Content-Type",
    "value": "application/json"
  }
]
```

**Relampo:**
```yaml
headers:
  Authorization: "Bearer {{token}}"
  Content-Type: "application/json"
```

**Reglas:**
- Headers con `disabled: true` se ignoran
- Variables Postman `{{var}}` se mantienen en Relampo
- Headers se adjuntan al request individual

#### 7.3.2 Request Body

**Postman (Raw JSON):**
```json
"body": {
  "mode": "raw",
  "raw": "{\"user\":\"{{username}}\",\"pass\":\"{{password}}\"}" 
}
```

**Relampo:**
```yaml
body: '{"user":"{{username}}","pass":"{{password}}"}'
```

#### 7.3.3 Folders/Groups

**Postman:**
```json
{
  "name": "User Management",
  "item": [
    { "request": {...} },
    { "request": {...} }
  ]
}
```

**Relampo:**
```yaml
- group:
    name: "User Management"
    steps:
      - request: {...}
      - request: {...}
```

#### 7.3.4 Variable Extraction (Test Scripts)

**Postman:**
```javascript
pm.environment.set("user_id", pm.response.json().data.id);
pm.collectionVariables.set("token", pm.response.json().token);
```

**Relampo:**
```yaml
extract:
  user_id: 'jsonpath("$.data.id")'
  token: 'jsonpath("$.token")'
```

**Patrón Detectado:**
- `pm.environment.set("var", pm.response.json().field)` → `extract: { var: 'jsonpath("$.field")' }`
- `pm.collectionVariables.set("var", pm.response.json().field)` → `extract: { var: 'jsonpath("$.field")' }`

### 7.4 Limitaciones de Postman

#### 7.4.1 Authentication

**No Soportado Automáticamente:**
- Bearer token auth
- Basic auth
- OAuth 2.0
- API Key auth

**Solución:** Se detecta y reporta en limitations. Usuario debe configurar manualmente en `http_defaults.headers` o por request.

#### 7.4.2 Pre-request Scripts

**Postman:**
```javascript
let timestamp = Date.now();
pm.environment.set("timestamp", timestamp);
```

**Limitación:** No hay equivalente directo. Se reporta en statistics.

**Solución Manual:** Usar `spark` con `when: before` si es crítico.

#### 7.4.3 Complex Test Scripts

**Postman:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response time < 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});
```

**Limitación:** Solo extracción de variables es soportada. Tests/assertions deben configurarse manualmente.

**Solución Manual:** Usar `assert` en Relampo:
```yaml
assert:
  status: 200
  response_time_max: "500ms"
```

#### 7.4.4 Collection Variables

**Postman:**
```json
"variable": [
  {
    "key": "base_url",
    "value": "https://api.example.com"
  }
]
```

**Limitación:** No se convierten automáticamente.

**Solución Manual:** Agregar a sección `variables` en YAML.

### 7.5 Estadísticas de Conversión Postman

El conversor rastrea:
- **HTTP Requests**: Total de requests en la colección
- **Folders/Groups**: Carpetas organizacionales
- **Extractors**: Variables extraídas de test scripts
- **Authentication**: Requests con auth configurada
- **Pre-request Scripts**: Requests con pre-scripts
- **Test Scripts**: Requests con test scripts complejos
- **Collection Auth**: Si la colección tiene auth a nivel global
- **Collection Variables**: Si hay variables de colección

---

## 8. Lista de Verificación de Implementación

### Fase 1: Componentes Core JMeter (✅ Completo)
- [x] Extracción de metadata del Test Plan
- [x] Variables Definidas por Usuario
- [x] CSV Data Set Config
- [x] HTTP Defaults (ConfigTestElement)
- [x] HTTP Samplers (GET, POST, PUT, DELETE) - incluyendo disabled
- [x] Header Manager (global y por request)
- [x] Cookie Manager
- [x] Cache Manager
- [x] Extractores básicos (JSON, Regex, XPath)
- [x] Aserciones básicas (Response, JSON, Duration)
- [x] Controladores (Simple, Generic, Transaction, Loop, If)
- [x] Temporizadores (Constant, Uniform Random, Gaussian)

### Fase 2: Características Avanzadas JMeter (✅ Completo)
- [x] JSR223 PreProcessor/PostProcessor con conversión de código
- [x] BeanShell PreProcessor/PostProcessor con conversión de código
- [x] Extractor XPath
- [x] Detección de Extractores no soportados (Boundary, HTML, CSS/jQuery)
- [x] Detección de Aserciones no soportadas (Size, XMLSchema, HTML, MD5, etc.)
- [x] Controlador If con conversión de condición
- [x] Temporizador Gaussiano Aleatorio
- [x] Configuración de carga de Thread Group
- [x] Thread Group no cuenta como controller

### Fase 3: Sistema de Estadísticas y Warnings (✅ Completo)
- [x] Contadores de elementos convertidos
  - [x] HTTP Requests (solo enabled)
  - [x] Extractors
  - [x] Assertions
  - [x] Spark Scripts (Pre/PostProcessors)
  - [x] User Variables
  - [x] CSV Data Sources
  - [x] Timers
  - [x] Controllers
- [x] Detección de elementos no soportados por categoría
  - [x] Listeners (ResultCollector, ViewResults, etc.)
  - [x] Samplers No-HTTP (JDBC, FTP, SMTP, etc.)
  - [x] Controladores avanzados (While, ForEach, Switch, etc.)
  - [x] Assertions no soportadas
  - [x] Timers no soportados
- [x] Header con metadata y estadísticas
- [x] Lista de warnings categorizada
- [x] Nombres de elementos JMeter en YAML comments

### Fase 4: Conversión Postman JSON (✅ Completo)
- [x] Estructura básica de colección
- [x] HTTP Requests con método, URL, headers, body
- [x] Folders/Groups organizacionales
- [x] Extracción de variables desde test scripts
- [x] Detección de base_url
- [x] Request names incluidos
- [x] Estadísticas de conversión
  - [x] HTTP Requests
  - [x] Folders/Groups
  - [x] Extractors
- [x] Limitaciones categorizadas
  - [x] Collection-level authentication
  - [x] Collection variables
  - [x] Request authentication (conteo)
  - [x] Pre-request scripts (conteo)
  - [x] Complex test scripts (conteo)
- [x] Header con metadata y limitations

### Fase 5: UI y Experiencia de Usuario (✅ Completo)
- [x] Panel de Conversion Summary
  - [x] Elementos convertidos con contadores
  - [x] Elementos no soportados/limitaciones
  - [x] Validación de estructura
- [x] Funcionalidad de búsqueda en YAML output
  - [x] Highlight de texto buscado
  - [x] Navegación next/previous
  - [x] Keyboard shortcuts (Cmd/Ctrl+F, Enter, Shift+Enter, Escape)
- [x] Parser genérico para ambos formatos (JMX y Postman)
- [x] Detección automática de tipo de archivo
- [x] Manejo de errores con mensajes claros

### Fase 6: Calidad de Código (✅ Completo)
- [x] Conversión de Groovy/BeanShell a JavaScript
  - [x] Variables: `vars.get/put` → `vars.name`
  - [x] Response: `prev.*` → `response.*`
  - [x] JSON: `JsonSlurper` → `JSON.parse`
  - [x] Logging: `log.*` → `console.*`
  - [x] Base64: `Base64.*` → `btoa/atob`
  - [x] UUID generation
  - [x] Timestamp: `System.currentTimeMillis()` → `Date.now()`
- [x] Interpolación de variables: `${var}` → `{{var}}`
- [x] Manejo de elementos nested recursivamente
- [x] Conteo preciso durante conversión (no post-procesamiento)

---

## 8. Estrategia de Pruebas

### 8.1 Pruebas Unitarias

Probar conversiones de componentes individuales:

```javascript
describe('Conversor JMX', () => {
  test('convierte Variables Definidas por Usuario', () => {
    const jmx = `<Arguments>...</Arguments>`;
    const result = convertVariables(jmx);
    expect(result).toEqual({ var1: 'valor1' });
  });
  
  test('convierte JSR223 PreProcessor a spark before', () => {
    const jmx = `<JSR223PreProcessor>...</JSR223PreProcessor>`;
    const result = convertPreProcessor(jmx);
    expect(result.spark[0].when).toBe('before');
  });
});
```

### 8.2 Pruebas de Integración

Probar conversiones de archivos JMX completos:

```javascript
test('convierte plan de prueba JMeter completo', () => {
  const jmx = fs.readFileSync('test.jmx', 'utf-8');
  const yaml = convertJMXToPulseYAML(jmx);
  
  const parsed = YAML.parse(yaml);
  expect(parsed.test.name).toBe('Mi Plan de Prueba');
  expect(parsed.scenarios).toHaveLength(1);
  expect(parsed.scenarios[0].steps).toHaveLength(5);
});
```

### 8.3 Pruebas de Validación

Validar el YAML generado:

```javascript
test('YAML generado es formato Relampo válido', () => {
  const yaml = convertJMXToPulseYAML(jmxContent);
  const parsed = YAML.parse(yaml);
  
  // Validar estructura
  expect(parsed).toHaveProperty('test');
  expect(parsed).toHaveProperty('scenarios');
  expect(parsed.scenarios[0]).toHaveProperty('steps');
});
```

---

## 9. Ejemplos

### 9.1 Prueba API Simple

**JMeter JMX:**
```xml
<jmeterTestPlan>
  <hashTree>
    <TestPlan testname="Prueba API">
      <hashTree>
        <ThreadGroup testname="Usuarios">
          <intProp name="ThreadGroup.num_threads">10</intProp>
          <intProp name="ThreadGroup.ramp_time">30</intProp>
          <hashTree>
            <ConfigTestElement testname="Valores HTTP por Defecto">
              <stringProp name="HTTPSampler.domain">api.ejemplo.com</stringProp>
              <stringProp name="HTTPSampler.protocol">https</stringProp>
            </ConfigTestElement>
            <hashTree/>
            
            <HTTPSamplerProxy testname="Obtener Usuarios">
              <stringProp name="HTTPSampler.path">/usuarios</stringProp>
              <stringProp name="HTTPSampler.method">GET</stringProp>
            </HTTPSamplerProxy>
            <hashTree>
              <JSONPostProcessor testname="Extraer ID">
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

**Relampo YAML Convertido:**
```yaml
test:
  name: "Prueba API"
  version: "1.0"

http_defaults:
  base_url: "https://api.ejemplo.com"
  timeout: "30s"

scenarios:
  - name: "Usuarios"
    load:
      type: constant
      users: 10
      ramp_up: "30s"
    
    steps:
      - request:
          name: "Obtener Usuarios"
          method: GET
          url: /usuarios
          extract:
            user_id: 'jsonpath("$[0].id")'
```

### 9.2 Login con Variables y CSV

**JMeter (simplificado):**
- CSV Data Set: usuarios.csv (email, password)
- Variable: API_URL
- POST /login con credenciales
- Extraer token
- GET /perfil con token

**Relampo Convertido:**
```yaml
test:
  name: "Prueba Login"
  version: "1.0"

variables:
  API_URL: "https://api.ejemplo.com"

data_source:
  type: csv
  file: "usuarios.csv"
  mode: per_vu
  strategy: sequential
  on_exhausted: recycle
  bind:
    email: email
    password: password

http_defaults:
  base_url: "{{API_URL}}"

scenarios:
  - name: "Flujo Login Usuario"
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
          name: "Obtener Perfil"
          method: GET
          url: /perfil
          headers:
            Authorization: "Bearer {{auth_token}}"
          assert:
            status: 200
```

---

## 10. Mejoras Futuras

### 10.1 Características Avanzadas
- Soporte para parámetros de pruebas distribuidas
- Correlación avanzada (auto-detectar valores dinámicos)
- Comparación de rendimiento (resultados JMeter vs. Relampo)

### 10.2 Inteligencia de Código
- Conversión Groovy → JavaScript basada en AST
- Inferencia de tipos y validación
- Resolución automática de dependencias de variables

### 10.3 Mejoras de UI
- Diff visual de JMX vs. YAML
- Editor de mapeo interactivo
- Vista previa de conversión con advertencias

---

## 11. Referencias

- [Documentación Apache JMeter](https://jmeter.apache.org/usermanual/)
- [Especificación YAML de Relampo](./YAML_VALIDATOR_SPEC.md)
- [Esquema XML de Test Plan JMeter](https://jmeter.apache.org/usermanual/test_plan.html)
- [Referencia JavaScript (MDN)](https://developer.mozilla.org/es/docs/Web/JavaScript)

---

**Fin del Documento**
