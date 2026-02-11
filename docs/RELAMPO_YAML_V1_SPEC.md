# Especificación Relampo YAML v1

**Versión:** 1.0  
**Fecha:** 2026-02-11  
**Estado:** Oficial

---

## Propósito del documento

Este documento define cómo debe ser un script YAML en Relampo v1, incluyendo:

- La estructura global exacta
- Qué es un `scenario`
- Qué es `steps` y dónde vive
- Qué es un `step`
- Cómo se ejecutan los `request` y `group`
- Qué entra y qué NO entra en v1

El objetivo es que el YAML sea:

- **Determinista** - Mismo YAML = Misma ejecución
- **Legible** - Fácil de entender y mantener
- **Fácil de validar** - Reglas claras y verificables
- **Fácil de ejecutar** - El engine solo camina el árbol

---

## Principios de diseño

1. **El YAML es declarativo** - Describe qué hacer, no cómo hacerlo
2. **El orden en YAML ES el orden de ejecución** - Secuencial y predecible
3. **No existen flow, IDs ni referencias** - Todo es explícito
4. **El engine ejecuta árboles de steps** - Recorrido depth-first
5. **Cada Virtual User (VU) tiene su propio contexto** - Aislamiento por VU
6. **El YAML describe qué, el engine decide cómo** - Separación de responsabilidades

**Si algo viola uno de estos principios → no entra en v1.**

### Reglas clave

- Un `scenario` define la carga
- `steps` define el flujo
- Si está escrito en orden dentro de `steps`, así se ejecuta
- **El YAML no describe el flujo. El YAML ES el flujo.**

---

## Estructura global del script (nivel raíz)

Todo script Relampo v1 **DEBE** tener esta estructura raíz, y solo esta:

```yaml
test:           # Metadata del test (obligatorio)
variables:      # Variables globales (opcional)
data_source:    # Data source global (opcional)
http_defaults:  # Config HTTP por defecto (opcional)
scenarios:      # Lista de escenarios (obligatorio, mínimo 1)
metrics:        # Config de métricas (opcional)
```

---

## 1. test – Metadata del test

**Propósito:** Identificar el test. No afecta la ejecución.

```yaml
test:
  name: string            # obligatorio
  description: string     # opcional
  version: string|number  # opcional
```

**Ejemplo:**
```yaml
test:
  name: "API Load Test"
  description: "Performance testing for user API endpoints"
  version: "1.0"
```

---

## 2. variables – Variables globales

**Propósito:** Definir valores iniciales disponibles para todos los escenarios y VUs.

```yaml
variables:
  key: value
  api_key: ${ENV:API_KEY}        # desde variable de entorno
  password: ${SECRET:db_pass}     # desde gestor de secretos
```

**Reglas:**
- Scope por VU (cada VU tiene su propia copia)
- Pueden ser sobrescritas por `extract`
- No hay mutación arbitraria
- Soporta interpolación desde entorno (`${ENV:VAR}`) y secretos (`${SECRET:KEY}`)

### Precedencia de variables (de mayor a menor)

1. Variables extraídas en el request actual (via `extract`)
2. `data_source` del request específico
3. `data_source` global
4. `variables` globales

**Ejemplo:**
```yaml
variables:
  base_url: "https://api.example.com"
  api_key: ${ENV:API_KEY}
  default_timeout: "10s"
  username: "test_user"
```

---

## 3. data_source – Data Source global

**Propósito:** Definir una fuente de datos para poblar variables por VU (por ejemplo usuarios/credenciales, ids de producto, etc.).

### Ubicación

- `data_source` puede existir en la **raíz** (aplica como "default" del script)
- `data_source` también puede existir dentro de un **request** (aplica solo a ese request y sobrescribe la global)

### Forma canónica

```yaml
data_source:
  type: csv | json | inline          # obligatorio
  file: string                       # requerido si type=csv|json
  inline: any                        # requerido si type=inline (list/map)
  mode: per_vu | shared              # opcional (default: per_vu)
  strategy: sequential | random | unique  # opcional (default: sequential)
  bind:                              # obligatorio: cómo mapear campos -> variables
    <field_name>: <variable_name>
  on_exhausted: stop | recycle | fail_test  # opcional (default: recycle)
```

### Reglas v1

- `data_source` no cambia el orden de ejecución
- El engine lee datos y setea variables en el contexto del VU
- **`mode: per_vu`** significa "cada VU tiene su cursor/selección propia"
- **`mode: shared`** significa "cursor compartido" (útil para `unique` global)
- **`bind`** define qué campos se vuelven variables (ej. `username -> username`)
- Si `strategy: unique` y se agotan los datos:
  - `on_exhausted: stop` detiene el scenario para ese VU (determinista)
  - `on_exhausted: recycle` reinicia el cursor (default)
  - `on_exhausted: fail_test` falla todo el test (útil para validación estricta)

### Interacción con load

Si `load.users: 200` pero solo hay 100 registros únicos con `strategy: unique`:

- Con `on_exhausted: recycle`: los 100 usuarios adicionales reciclan datos
- Con `on_exhausted: stop`: 100 VUs se detienen al agotar datos
- Con `on_exhausted: fail_test`: el test falla inmediatamente

### Ejemplo en raíz

```yaml
data_source:
  type: csv
  file: "data/users.csv"
  mode: per_vu
  strategy: unique
  bind:
    email: user_email
    password: user_password
  on_exhausted: recycle
```

### Ejemplo dentro de un request

```yaml
- request:
    method: POST
    url: /login
    data_source:
      type: csv
      file: data/users.csv
      strategy: sequential
      bind:
        username: username
        password: password
    body:
      username: "{{username}}"
      password: "{{password}}"
```

**Precedencia:** `request.data_source` sobrescribe `root.data_source` solo para ese request.

---

## 4. http_defaults – Configuración HTTP por defecto

**Propósito:** Evitar repetición en los requests.

```yaml
http_defaults:
  base_url: string
  headers: map
  timeout: duration
  follow_redirects: boolean
  retry_policy:
    enabled: boolean
    max_attempts: int
    backoff: exponential | linear | fixed
```

**Reglas:**
- Se hereda automáticamente por todos los requests
- Puede ser sobrescrito por configuración a nivel de request

**Ejemplo:**
```yaml
http_defaults:
  base_url: "https://api.example.com"
  timeout: "30s"
  follow_redirects: true
  headers:
    Accept: "application/json"
    User-Agent: "Relampo/1.0"
```

---

## 5. scenarios – Definición de carga

**Propósito:** Definir cómo se genera la carga y qué ejecuta cada VU.

```yaml
scenarios:
  - name: string
    load:
      type: constant | ramp | spike | step  # tipo de carga
      
      # Para constant (default):
      users: int
      duration: duration
      ramp_up: duration
      iterations: int          # opcional: iteraciones por VU
      
      # Para ramp:
      start_users: int
      end_users: int
      duration: duration
      
      # Para spike:
      users: int               # usuarios base
      spike_users: int         # usuarios adicionales en spike
      spike_duration: duration
      spike_at: duration       # cuándo ocurre el spike
      
      # Para step:
      steps:
        - users: int
          duration: duration
    
    cookies:
      mode: auto | disabled | manual
      jar_scope: per_vu | shared           # alcance del cookie jar
      persist_across_iterations: boolean   # default: true
    
    cache_manager:
      enabled: boolean                     # default: false
      scope: per_vu | shared               # default: per_vu
      max_size_mb: int                     # default: 50
      eviction_policy: lru | fifo          # default: lru
    
    error_policy:
      on_4xx: continue | stop | fail_iteration  # default: continue
      on_5xx: retry | stop | continue           # default: continue
      on_timeout: retry | stop | continue       # default: stop
    
    steps: [ step ]  # ← AQUÍ VIVEN LOS STEPS
```

### Regla crítica

- ✅ Un script sin `scenarios` es **inválido**
- ✅ Un `scenario` sin `steps` no es **ejecutable**

**Ejemplo:**
```yaml
scenarios:
  - name: "User Login Flow"
    load:
      type: constant
      users: 50
      duration: "5m"
      ramp_up: "30s"
    
    cookies:
      mode: auto
      persist_across_iterations: true
    
    error_policy:
      on_4xx: continue
      on_5xx: retry
      on_timeout: stop
    
    steps:
      - get: /
      - post: /login
      - get: /dashboard
```

---

## 6. steps – Núcleo del scripting

### ¿Qué es steps?

`steps` es una **lista ordenada de acciones** que ejecuta cada VU.

**IMPORTANTE:**
- `steps` **NO** es raíz del script
- `steps` vive únicamente dentro de un `scenario`

```yaml
scenarios:
  - name: Example
    load: {...}
    steps:     # ← steps vive AQUÍ
      - <step>
      - <step>
```

### ¿Qué es un step?

Un `step` es la **unidad mínima de ejecución** del engine.

Un step puede:
- **Ejecutar algo** (request, think time, assertions, etc.)
- **Contener otros steps** (controllers como `group`, `if`, `loop`)

Un step:
- ❌ No tiene ID
- ❌ No referencia otros steps
- ✅ Se ejecuta secuencialmente

### Estructura EXACTA de un step

Cada elemento dentro de `steps` debe tener **una sola key**, que define su tipo.

**Forma corta (HTTP):**
```yaml
- get: /path
- post: /path
- put: /path
- delete: /path
- patch: /path
- head: /path
- options: /path
```

**Forma larga (canónica):**
```yaml
- <step_type>:
    <config>
```

**Ejemplo:**
```yaml
- request:
    method: POST
    url: /api/login
    body:
      username: "{{user}}"
```

---

## 7. Tipos de step soportados en v1

### 7.1 Request Step

```yaml
- request:
    method: GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS
    url: string
    headers: map               # opcional
    query_params: map          # opcional
    body: any                  # opcional
    timeout: duration          # opcional
    extract: map               # opcional
    assert: map                # opcional
    retry: map                 # opcional
    on_error: continue|stop    # opcional
    data_source: map           # opcional (sobrescribe global)
    spark: list                # opcional (scripts personalizados)
```

**Forma corta:**
```yaml
- get: /users?page=1
- post: 
    url: /login
    body:
      user: test
```

La forma corta (`get: /path`) se normaliza internamente al formato largo.

**Ejemplo completo:**
```yaml
- request:
    method: POST
    url: /api/login
    headers:
      Content-Type: "application/json"
    body:
      email: "{{user_email}}"
      password: "{{user_password}}"
    extract:
      token: $.data.token
      user_id: $.data.user.id
    assert:
      status: 200
      response_time_ms: <500
```

---

### 7.2 Extract – Extracción de datos

**Sintaxis de selección soportada:**

```yaml
extract:
  # JSONPath (para responses JSON)
  token: $.data.token
  user_id: $.user.id
  items: $.items[*].name
  
  # XPath (para responses XML)
  session: xpath://session/@id
  user: xpath://user/name/text()
  
  # Headers
  session_cookie: header.Set-Cookie
  content_type: header.Content-Type
  
  # Regex (con grupos de captura)
  csrf_token: regex("csrf_token=([a-zA-Z0-9]+)")
  user_email: regex("<email>(.+?)</email>")
  
  # Body completo
  full_response: body
```

**Reglas:**
- Las variables extraídas tienen **mayor precedencia** que `data_source`
- Las extracciones son **por VU**
- Se validan en tiempo de ejecución (opcional: strict mode)

---

### 7.3 Assert – Validaciones

```yaml
assert:
  # Status code
  status: 200                    # código exacto
  status_in: [200, 201, 202]    # lista de códigos válidos
  status_not_in: [500, 502, 503]
  
  # Response time (CRÍTICO para performance testing)
  response_time_ms: <500         # menor que
  response_time_ms_max: 1000     # máximo absoluto
  response_time_ms_min: 100      # mínimo absoluto
  response_time_ms_between: [100, 500]
  
  # Body/Content
  body_contains: "success"
  body_not_contains: "error"
  body_matches: regex("status.*ok")
  
  # JSONPath
  json_path:
    $.status: "ok"
    $.data.count: ">0"
    $.items: "exists"
  
  # XPath
  xpath:
    //status/text(): "success"
  
  # Headers
  header_exists: Content-Type
  header_contains:
    Content-Type: "application/json"
  
  # Size
  body_size_bytes: <10000
  
  # Custom (expresión)
  custom: "{{status_code}} == 200 && {{response_time}} < 500"
```

**Comportamiento en fallo:**
- **Default:** se registra el fallo pero continúa (soft assertion)
- Con `on_error: stop`: detiene el VU inmediatamente

---

### 7.4 Spark – Scripts Personalizados

`spark` permite ejecutar código JavaScript antes o después de un request.

```yaml
- request:
    method: GET
    url: /api/data
    
    spark:
      - when: before
        name: "Setup variables"  # opcional
        script: |
          // Código ejecutado ANTES del request
          vars.timestamp = Date.now();
          vars.request_id = 'xxxxxxxx'.replace(/x/g, () => 
            Math.floor(Math.random() * 16).toString(16)
          );
      
      - when: after
        name: "Process response"  # opcional
        script: |
          // Código ejecutado DESPUÉS del request
          const data = JSON.parse(response.body);
          vars.item_count = data.items.length;
          console.log("Items found: " + vars.item_count);
```

**Reglas:**
- `when` puede ser: `before` o `after`
- `name` es opcional (para identificación)
- `script` contiene código JavaScript
- Acceso a contexto:
  - `vars` - variables del VU
  - `response` - respuesta del request (solo en `after`)
    - `response.body` - cuerpo de la respuesta
    - `response.status` - código de estado
    - `response.duration_ms` - tiempo de respuesta
    - `response.headers` - headers de respuesta

**Conversiones comunes de JMeter/Groovy:**
- `vars.get("name")` → `vars.name`
- `vars.put("name", value)` → `vars.name = value`
- `log.info(msg)` → `console.log(msg)`
- `new JsonSlurper().parseText(str)` → `JSON.parse(str)`
- `System.currentTimeMillis()` → `Date.now()`

---

### 7.5 Think Time Step

```yaml
# Forma simple (tiempo fijo)
- think_time: 2s

# Forma avanzada (tiempo variable)
- think_time:
    min: 1s
    max: 3s
    distribution: uniform | normal | poisson

# Forma con percentil (para normal distribution)
- think_time:
    mean: 2s
    std_dev: 500ms
    distribution: normal
```

**Unidades soportadas:** `ms`, `s`, `m`, `h`

---

### 7.6 Group Step (controller)

```yaml
- group:
    name: string        # opcional
    steps: [ step ]     # obligatorio (mínimo 1)
```

**Importante:**
- `group` **NO** altera el orden
- Solo organiza y anida requests
- Útil para métricas agregadas por grupo

**Ejemplo:**
```yaml
- group:
    name: "User Authentication"
    steps:
      - get: /login
      - post: /login
        body:
          username: "{{user}}"
          password: "{{pass}}"
      - get: /profile
```

---

### 7.7 If Step (controller)

```yaml
- if: condition
  steps: [ step ]
```

**Ejemplo:**
```yaml
- if: "{{token}} != null"
  steps:
    - get: /profile
      headers:
        Authorization: "Bearer {{token}}"
```

**Reglas v1:**
- ❌ Sin `else` (si necesitas `else`, usa dos `if` con condiciones inversas)
- Condición simple (expresiones booleanas)
- **Operadores soportados:** `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`

---

### 7.8 Loop Step (controller)

```yaml
# Forma simple (iteraciones fijas)
- loop: int
  steps: [ step ]

# Forma avanzada
- loop:
    count: int
    break_on: condition  # opcional: condición de salida
  steps: [ step ]
```

**Ejemplo:**
```yaml
- loop: 3
  steps:
    - get: /api/items
    - think_time: 500ms

# Con break_on
- loop:
    count: 10
    break_on: "{{item_found}} == true"
  steps:
    - get: /search?q={{query}}
      extract:
        item_found: $.found
```

---

### 7.9 Retry Step (controller)

```yaml
- retry:
    attempts: int                              # número de reintentos
    on: [status_codes]                         # códigos que provocan retry
    backoff: exponential | linear | fixed      # estrategia de espera
    initial_delay: duration                    # delay inicial (default: 1s)
    max_delay: duration                        # delay máximo (default: 30s)
    multiplier: float                          # para exponential (default: 2)
  steps: [ step ]
```

**Ejemplo:**
```yaml
- retry:
    attempts: 3
    on: [500, 502, 503, 504]
    backoff: exponential
    initial_delay: 1s
    max_delay: 10s
    multiplier: 2
  steps:
    - post: /payment
      headers:
        Authorization: "Bearer {{token}}"
      body:
        amount: 100
```

**Comportamiento de backoff:**
- `fixed`: siempre espera `initial_delay`
- `linear`: `initial_delay * attempt_number`
- `exponential`: `initial_delay * (multiplier ^ attempt_number)`, hasta `max_delay`

---

### 7.10 On_Error – Manejo de error por request

```yaml
- post: /logout
  headers:
    Authorization: "Bearer {{token}}"
  on_error: continue | stop | fail_iteration
```

**Opciones:**
- `continue`: registra el error y continúa (default)
- `stop`: detiene el VU inmediatamente
- `fail_iteration`: marca la iteración como fallida pero continúa con siguiente iteración

---

## 8. Funciones Built-in para Variables

Dentro de cualquier campo que soporte interpolación (`{{...}}`), están disponibles:

```yaml
# Generadores
{{$uuid}}           # UUID v4
{{$timestamp}}      # Unix timestamp (segundos)
{{$timestamp_ms}}   # Unix timestamp (milisegundos)
{{$random}}         # Float aleatorio [0, 1)
{{$random_int(1, 100)}}  # Int aleatorio en rango
{{$random_string(10)}}   # String aleatorio de N caracteres

# Funciones de texto
{{$upper(variable)}}     # MAYÚSCULAS
{{$lower(variable)}}     # minúsculas
{{$substring(var, 0, 5)}}

# Funciones matemáticas
{{$add(var1, var2)}}
{{$subtract(var1, var2)}}
{{$multiply(var1, var2)}}
{{$divide(var1, var2)}}

# Codificación
{{$base64_encode(text)}}
{{$base64_decode(text)}}
{{$url_encode(text)}}
{{$url_decode(text)}}

# Hash
{{$md5(text)}}
{{$sha256(text)}}
```

**Ejemplo:**
```yaml
- post: /api/items
  headers:
    X-Request-ID: "{{$uuid}}"
    X-Timestamp: "{{$timestamp}}"
  body:
    id: "{{$random_int(1000, 9999)}}"
    name: "Item-{{$random_string(8)}}"
```

---

## 9. request y group dentro de steps (CLAVE)

**Ejemplo mezclado (request + group):**

```yaml
steps:
  - get: /
  - group:
      name: Static Assets
      steps:
        - get: /styles.css
        - get: /app.js
  - post: /api/login
    body:
      email: test@test.com
      password: secret
  - get: /api/profile
```

**Ejecución real:**
1. `GET /`
2. `GET /styles.css`
3. `GET /app.js`
4. `POST /api/login`
5. `GET /api/profile`

**Group anidado (válido):**

```yaml
steps:
  - group:
      name: Checkout
      steps:
        - group:
            name: Cart
            steps:
              - get: /cart
              - post: /cart/add
        - post: /checkout
```

El engine camina el árbol, sin lógica adicional.

---

## 10. Cómo se ejecuta el YAML (modelo mental)

**Regla fundamental:** El orden en el YAML ES el orden de ejecución.

**Pseudocódigo del engine:**

```javascript
function executeSteps(steps) {
  for (const step of steps) {
    switch (step.type) {
      case 'REQUEST':
        executeRequest(step);
        break;
      case 'GROUP':
        executeSteps(step.steps);
        break;
      case 'IF':
        if (evaluate(step.condition)) {
          executeSteps(step.steps);
        }
        break;
      case 'LOOP':
        for (let i = 0; i < step.count; i++) {
          executeSteps(step.steps);
          if (evaluateBreakCondition(step)) {
            break;
          }
        }
        break;
      case 'RETRY':
        executeWithRetry(step);
        break;
      case 'THINK_TIME':
        sleep(step.duration);
        break;
    }
  }
}
```

**No hay:**
- ❌ `flow`
- ❌ Referencias
- ❌ Grafos
- ❌ Planificación dinámica

---

## 11. metrics – Configuración de métricas

```yaml
metrics:
  enabled: boolean                      # default: true
  percentiles: [50, 90, 95, 99, 99.9]  # percentiles a calcular
  collect_interval: duration            # default: 10s
  
  # Agregación
  aggregate_by:
    - scenario
    - group
    - request
  
  # Exportación
  export:
    - type: json
      file: results.json
      pretty: boolean
    - type: csv
      file: results.csv
      delimiter: ","
    - type: prometheus
      endpoint: /metrics
      port: 9090
    - type: influxdb
      url: http://localhost:8086
      database: relampo_metrics
      retention_policy: autogen
  
  # Métricas customizadas
  custom_metrics:
    - name: checkout_success_rate
      type: counter | gauge | histogram
      labels: [scenario, status]
```

El YAML declara **qué medir**, no cómo visualizar.

---

## 12. Reglas de Validación

Todo script Relampo v1 **DEBE** cumplir con estas reglas:

### Validaciones estructurales

- ✅ Un script DEBE tener al menos un `scenario`
- ✅ Un `scenario` DEBE tener al menos un `step` en `steps`
- ✅ Un `group` DEBE tener al menos un `step` en `steps`
- ✅ Un `loop` DEBE tener `count > 0`
- ✅ Un `retry` DEBE tener `attempts > 0`

### Validaciones de formato

- ✅ `duration` DEBE ser formato: `<number><unit>` donde `unit = ms|s|m|h`
  - **Válido:** `1s`, `500ms`, `2m`, `1h`
  - **Inválido:** `1`, `2 seconds`, `500`
- ✅ `extract` keys DEBEN ser identificadores válidos (`a-z`, `A-Z`, `0-9`, `_`)
- ✅ `on_exhausted` solo es válido si `strategy: unique`

### Validaciones de datos

- ✅ Si `data_source.type: csv|json`, el campo `file` es obligatorio
- ✅ Si `data_source.type: inline`, el campo `inline` es obligatorio
- ✅ `data_source.bind` DEBE tener al menos un mapeo
- ✅ `load.users` DEBE ser `> 0`
- ✅ `load.duration` DEBE ser `> 0` si se especifica

### Validaciones de lógica

- ✅ No puede haber `steps` vacío
- ✅ Headers pueden usar interpolación: `Authorization: "Bearer {{token}}"`
- ✅ Body puede ser: `string`, `map`, o template con interpolación

---

## 13. Qué NO existe en Relampo YAML v1

- ❌ `steps` en nivel raíz
- ❌ `flow`
- ❌ Controllers separados
- ❌ IDs
- ❌ Referencias por índice
- ❌ `else` en `if` (usa dos `if` con condiciones inversas)
- ❌ `until`, `foreach` (usa `loop` con `break_on`)
- ❌ `try/catch` (usa `on_error` y `retry`)

---

## 14. Script de Ejemplo Completo

Este ejemplo cubre **TODOS** los tipos de step y features soportados:

```yaml
test:
  name: Relampo YAML v1 – Complete Example
  description: Script demostrativo que cubre todos los casos soportados en v1
  version: 1.0

variables:
  base_url: https://api.example.com
  api_version: v1
  api_key: ${ENV:API_KEY}

data_source:
  type: csv
  file: data/users.csv
  mode: per_vu
  strategy: unique
  bind:
    email: user_email
    password: user_password
  on_exhausted: recycle

http_defaults:
  base_url: https://api.example.com
  timeout: 10s
  headers:
    Accept: application/json
    User-Agent: Relampo-Test
    X-API-Key: "{{api_key}}"

scenarios:
  - name: Full Feature Coverage Scenario
    load:
      type: ramp
      start_users: 1
      end_users: 50
      duration: 5m
    
    cookies:
      mode: auto
      jar_scope: per_vu
      persist_across_iterations: true
    
    cache_manager:
      enabled: true
      scope: per_vu
      max_size_mb: 100
      eviction_policy: lru
    
    error_policy:
      on_4xx: continue
      on_5xx: retry
      on_timeout: stop
    
    steps:
      # 1️⃣ REQUEST SIMPLE (forma corta)
      - get: /health
      
      # 2️⃣ REQUEST COMPLETO con extract y assert
      - request:
          method: POST
          url: /{{api_version}}/login
          body:
            username: "{{user_email}}"
            password: "{{user_password}}"
          extract:
            token: $.data.token
            user_id: $.data.user.id
            session: header.Set-Cookie
          assert:
            status: 200
            response_time_ms: <500
            json_path:
              $.data.token: "exists"
              $.data.user.id: ">0"
      
      # 3️⃣ SPARK - Scripts personalizados
      - request:
          method: GET
          url: /profile
          
          spark:
            - when: before
              name: "Generate request ID"
              script: |
                vars.request_id = Date.now().toString() + 
                  Math.random().toString(36).substring(2, 15);
                console.log("Request ID: " + vars.request_id);
            
            - when: after
              name: "Process profile data"
              script: |
                const profile = JSON.parse(response.body);
                vars.user_name = profile.name;
                vars.account_type = profile.account_type;
          
          headers:
            Authorization: "Bearer {{token}}"
            X-Request-ID: "{{request_id}}"
      
      # 4️⃣ THINK TIME variable
      - think_time:
          min: 1s
          max: 3s
          distribution: normal
      
      # 5️⃣ GROUP con requests autenticados
      - group:
          name: Load User Area
          steps:
            - get: /profile
              headers:
                Authorization: "Bearer {{token}}"
              assert:
                status_in: [200, 304]
            
            - get: /orders
              headers:
                Authorization: "Bearer {{token}}"
              extract:
                order_count: $.meta.total
      
      # 6️⃣ IF condicional
      - if: "{{token}} != null && {{order_count}} > 0"
        steps:
          - get: /notifications
            headers:
              Authorization: "Bearer {{token}}"
              X-Request-ID: "{{$uuid}}"
      
      # 7️⃣ LOOP con break_on
      - loop:
          count: 5
          break_on: "{{product_found}} == true"
        steps:
          - get: /products?page={{$random_int(1, 10)}}
            extract:
              product_found: $.data[0].id
          - think_time: 500ms
      
      # 8️⃣ RETRY con backoff exponencial
      - retry:
          attempts: 3
          on: [500, 502, 503, 504]
          backoff: exponential
          initial_delay: 1s
          max_delay: 10s
          multiplier: 2
        steps:
          - post: /payment
            headers:
              Authorization: "Bearer {{token}}"
              Idempotency-Key: "{{$uuid}}"
            body:
              amount: 100
              currency: USD
              order_id: "{{$random_int(1000, 9999)}}"
            assert:
              status_in: [200, 201]
              json_path:
                $.status: "success"
      
      # 9️⃣ ON_ERROR manejo por request
      - post: /analytics/event
        headers:
          Authorization: "Bearer {{token}}"
        body:
          event: checkout_completed
          timestamp: "{{$timestamp}}"
          user_id: "{{user_id}}"
        on_error: continue
      
      # 🔟 Funciones built-in
      - post: /feedback
        headers:
          X-Correlation-ID: "{{$uuid}}"
          X-Timestamp: "{{$timestamp_ms}}"
        body:
          rating: "{{$random_int(1, 5)}}"
          comment: "Test-{{$random_string(8)}}"
          hash: "{{$sha256(user_id)}}"
      
      # 1️⃣1️⃣ LOGOUT final
      - delete: /sessions/{{token}}
        headers:
          Authorization: "Bearer {{token}}"
        assert:
          status_in: [200, 204]
        on_error: continue

metrics:
  enabled: true
  percentiles: [50, 90, 95, 99, 99.9]
  collect_interval: 5s
  aggregate_by:
    - scenario
    - group
    - request
  export:
    - type: json
      file: results/complete-example.json
      pretty: true
    - type: csv
      file: results/complete-example.csv
    - type: prometheus
      endpoint: /metrics
      port: 9090
  custom_metrics:
    - name: login_success_rate
      type: counter
      labels: [scenario, status]
```

---

## 15. Checklist de Features

| Feature | Ejemplo en el script |
|---------|---------------------|
| Request forma corta | `get: /health` |
| Request forma larga | `request: POST /login` |
| Data source global | raíz del YAML |
| Data source en request | `POST /login` |
| Extract (JSONPath) | `$.data.token` |
| Extract (Header) | `header.Set-Cookie` |
| Assert status | `status: 200` |
| Assert response time | `response_time_ms: <500` |
| Assert JSONPath | `$.data.token: "exists"` |
| Spark before | `when: before` |
| Spark after | `when: after` |
| Think time fijo | `think_time: 500ms` |
| Think time variable | `min/max/distribution` |
| Group | `Load User Area` |
| Group anidado | Posible (no en ejemplo) |
| If condicional | `if: "{{token}} != null"` |
| Loop fijo | `loop: 3` |
| Loop con break | `break_on: condition` |
| Retry con backoff | bloque `/payment` |
| on_error | `/analytics/event` |
| Variables de entorno | `${ENV:API_KEY}` |
| Funciones built-in | `{{$uuid}}`, `{{$timestamp}}` |
| Load type: ramp | en scenario |
| Cookies auto | en scenario |
| Cache manager | en scenario |
| Error policy | en scenario |
| Metrics export | múltiples formatos |

---

## Fin de la especificación Relampo YAML v1

**Documento completo y actualizado con todas las características soportadas en v1.**
