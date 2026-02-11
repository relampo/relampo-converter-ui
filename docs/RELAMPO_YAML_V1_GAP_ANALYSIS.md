# Relampo YAML v1 - Análisis de Gaps y Recomendaciones

**Versión:** 1.0  
**Fecha:** Febrero 2026  
**Comparación con:** JMeter 5.x, k6 v0.x, Gatling 3.x

---

## 1. Introducción

Este documento identifica elementos faltantes en Relampo YAML v1 comparándolo con las herramientas líderes de performance testing: JMeter, k6 y Gatling.

### Categorías de Análisis

- ✅ **Elementos Completos**: Ya implementados en Relampo v1
- 🟡 **Cubiertos Parcialmente**: Posible con workarounds usando features existentes
- 🔴 **Gaps Críticos**: Elementos faltantes que deberían agregarse
- ⛔ **Fuera de Scope**: Elementos imposibles o no deseables en YAML declarativo

---

## 2. ✅ Elementos Completos en Relampo v1

### 2.1 Protocolo HTTP
- ✅ Todos los métodos HTTP: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- ✅ Headers dinámicos y estáticos
- ✅ Query parameters y URL templates
- ✅ Body types: JSON, XML, form-data, raw
- ✅ Cookie management global y por request
- ✅ Cache manager con políticas

### 2.2 Modelos de Carga
- ✅ `constant`: Carga constante (JMeter ThreadGroup, k6 constant VUs)
- ✅ `ramp`: Rampa lineal (Gatling rampUsers)
- ✅ `spike`: Picos de carga (k6 ramping VUs)
- ✅ `step`: Carga escalonada (Gatling incrementUsersPerSec)

### 2.3 Extracción de Datos
- ✅ JSONPath (JMeter JSONPostProcessor, k6 json path)
- ✅ XPath (JMeter XPathExtractor)
- ✅ Regex (JMeter RegexExtractor, Gatling regex)
- ✅ Headers extraction
- ✅ Scope: variable global o local

### 2.4 Validaciones
- ✅ Status code assertions
- ✅ Response time assertions
- ✅ JSON assertions (JSONPath + expected value)
- ✅ Body contains/regex assertions
- ✅ Size assertions

### 2.5 Control de Flujo
- ✅ `group`: Agrupación lógica (JMeter Transaction Controller, k6 group)
- ✅ `if`: Condicional (JMeter If Controller, k6 if statement)
- ✅ `loop`: Iteración con break_on (JMeter Loop Controller, Gatling repeat)
- ✅ `retry`: Reintentos (k6 no nativo, Gatling tryMax)
- ✅ `on_error`: Manejo de errores (JMeter on_sample_error)
- ✅ `think_time`: Pausas (JMeter Timers, k6 sleep, Gatling pause)

### 2.6 Scripting
- ✅ `spark`: Scripts before/after (JMeter JSR223, k6 JavaScript, Gatling exec)
- ✅ Acceso a variables, response, request
- ✅ Built-in functions: `$uuid()`, `$timestamp()`, `$random_int()`, `$random_string()`, `$base64()`

### 2.7 Data Sources
- ✅ CSV files con headers
- ✅ JSON arrays
- ✅ Modes: `per_user`, `shared`, `per_iteration`
- ✅ Strategies: `sequential`, `random`
- ✅ `on_exhausted`: `loop`, `stop`, `continue`

### 2.8 Variables
- ✅ Variables globales
- ✅ Precedencia: extract > data_source > variables
- ✅ Interpolación: `{{variable_name}}`

### 2.9 Métricas
- ✅ Percentiles configurables
- ✅ Custom metrics básicos
- ✅ Error policy: `continue`, `abort`
- ✅ Default assertions (check_status)

---

## 3. 🟡 Elementos Cubiertos Parcialmente

### 3.1 Correlación Automática
**Herramientas:** JMeter Correlation Recorder, BlazeMeter Correlation Extractor

**Estado en Relampo:**
- ❌ No hay auto-detección de valores dinámicos (session IDs, tokens, CSRF)
- ✅ Se puede hacer manualmente con `extract` + variables

**Workaround:**
```yaml
# Manual - Extraer token de login
- post: /api/login
  body: {...}
  extract:
    auth_token: $.data.token
    session_id: header.Set-Cookie

# Usar en siguiente request
- get: /api/profile
  headers:
    Authorization: "Bearer {{auth_token}}"
```

**Limitación:** Requiere identificar manualmente qué extraer.

---

### 3.2 Parametrización desde Múltiples Fuentes
**Herramientas:** JMeter múltiples CSV Data Set Config

**Estado en Relampo:**
- ✅ Un `data_source` global
- ❌ No se pueden tener múltiples data sources simultáneos

**Workaround:**
```yaml
# Global para usuarios
data_source:
  type: csv
  file: users.csv

scenarios:
  - steps:
      # Sobrescribir localmente para productos
      - request:
          url: /api/product/{{product_id}}
          data_source:
            type: csv
            file: products.csv
```

**Limitación:** Solo un data_source activo a la vez por nivel (global o request).

**Recomendación:** ⚠️ Permitir múltiples data_sources con nombres únicos.

---

### 3.3 Weighted Random Selection
**Herramientas:** Gatling `randomSwitch`, k6 weighted scenarios

**Estado en Relampo:**
- ❌ No hay step para ejecutar requests con probabilidad
- ✅ Se puede simular con `spark` + `if`

**Workaround:**
```yaml
- request:
    spark:
      - when: before
        script: |
          vars.random_choice = Math.random();

# 30% probabilidad
- if: "{{random_choice}} < 0.3"
  steps:
    - get: /api/heavy-operation

# 70% probabilidad
- if: "{{random_choice}} >= 0.3"
  steps:
    - get: /api/light-operation
```

**Limitación:** Verboso y no es obvio que implementa weighted selection.

**Recomendación:** 🔴 Agregar step `weighted` nativo:
```yaml
- weighted:
    - weight: 30
      steps:
        - get: /api/heavy-operation
    - weight: 70
      steps:
        - get: /api/light-operation
```

---

### 3.4 Transactions con SLA/Thresholds
**Herramientas:** JMeter Transaction Controller + Response Time Graph, Gatling `group` con assertions

**Estado en Relampo:**
- ✅ `group` para agrupar lógicamente
- ❌ No se puede definir SLA a nivel de transaction
- ✅ Se pueden poner `assert` en cada request

**Workaround:**
```yaml
- group:
    name: "Login Transaction"
    steps:
      - post: /api/login
        assert:
          response_time_ms_max: 2000  # SLA individual
      - get: /api/profile
        assert:
          response_time_ms_max: 1000
```

**Limitación:** SLA no es para el grupo completo, sino por request.

**Recomendación:** ⚠️ Agregar `group.sla`:
```yaml
- group:
    name: "Login Transaction"
    sla:
      max_duration_ms: 3000  # Duración total del grupo
    steps: [...]
```

---

### 3.5 Pacing (Throughput Control)
**Herramientas:** JMeter Constant Throughput Timer, k6 rate limiting

**Estado en Relampo:**
- ✅ `think_time` entre requests
- ❌ No hay control directo de "N requests por segundo"

**Workaround:**
```yaml
# Para 10 req/s con 50 VUs:
# Pacing = VUs / target_rps = 50 / 10 = 5s
scenarios:
  - load:
      users: 50
    steps:
      - get: /api/endpoint
      - think_time: 5s  # Manual pacing
```

**Limitación:** Cálculo manual, no garantiza throughput exacto.

**Recomendación:** ⚠️ Agregar `pacing` o `target_rps`:
```yaml
scenarios:
  - load:
      users: 50
      target_rps: 10  # Engine calcula think_time automático
```

---

### 3.6 ForEach Loop sobre Arrays
**Herramientas:** JMeter ForEach Controller, k6 array iteration

**Estado en Relampo:**
- ✅ `loop` con iteraciones fijas
- ❌ No se puede iterar sobre un array de variables

**Workaround:**
```yaml
# Limitado - no se puede iterar array directamente
- loop: 5
  steps:
    - get: /api/item/{{$random_int(1, 100)}}
```

**Limitación:** No hay forma de iterar sobre `["item1", "item2", "item3"]`.

**Recomendación:** ⚠️ Agregar `foreach`:
```yaml
- request:
    spark:
      - when: before
        script: |
          vars.item_ids = [101, 102, 103, 104];

- foreach:
    var: item_id
    in: "{{item_ids}}"
    steps:
      - get: /api/item/{{item_id}}
```

---

### 3.7 Módulos Reutilizables
**Herramientas:** JMeter Module Controller, Gatling scenarios composition

**Estado en Relampo:**
- ❌ No hay forma de definir bloques reutilizables
- ❌ Duplicación de steps (viola DRY)

**Workaround:**
```yaml
# Copy-paste manual
scenarios:
  - name: "Scenario 1"
    steps:
      - get: /api/auth
      - post: /api/login  # Duplicado
      # ... más steps

  - name: "Scenario 2"
    steps:
      - get: /api/auth
      - post: /api/login  # Duplicado otra vez
      # ... más steps
```

**Limitación:** No se puede reutilizar, mantenimiento complejo.

**Recomendación:** 🔴 Agregar `modules` o `include` (pero viola principio "sin referencias externas"):
```yaml
# Opción 1: Módulos inline
modules:
  - name: login_flow
    steps:
      - get: /api/auth
      - post: /api/login

scenarios:
  - steps:
      - module: login_flow  # Referencia inline
```

```yaml
# Opción 2: Include externo
scenarios:
  - steps:
      - include: flows/login.yaml  # Archivo externo
```

**Nota:** Esto requiere decisión de diseño (mantener YAML auto-contenido vs DRY).

---

## 4. 🔴 Gaps Críticos - Elementos Faltantes

### 4.1 Checks vs Assertions (Soft Validations)
**Herramientas:** k6 `checks` con thresholds

**Problema:**
- En k6, `checks` son soft (no detienen ejecución, solo miden % éxito)
- En Relampo, `assert` siempre detiene si falla (hard assertion)

**k6 Example:**
```javascript
// Checks: soft validations
check(response, {
  'status is 200': (r) => r.status === 200,
  'response time < 500ms': (r) => r.timings.duration < 500
});

// Thresholds: fail criteria para el test completo
export const options = {
  thresholds: {
    checks: ['rate > 0.95'],  // 95% de checks deben pasar
  }
};
```

**Estado en Relampo:**
```yaml
# Solo hard assertions
- get: /api/endpoint
  assert:
    status: 200  # Si falla → error
```

**Recomendación:** 🔴 Agregar `checks` separado de `assert`:
```yaml
test:
  name: "API Test"

# Soft checks - no detienen ejecución
checks:
  - id: status_ok
    condition: "{{status}} == 200"
  - id: fast_response
    condition: "{{response_time}} < 500"

scenarios:
  - steps:
      - get: /api/endpoint
        checks:  # Aplican soft validations
          - status_ok
          - fast_response
        # Sin "assert" - no detiene si falla

# Fail criteria global
metrics:
  thresholds:
    checks_passed_rate: 0.95  # 95% de checks deben pasar
    response_time_p95: 1000
```

**Beneficio:** Permite testear degradación gradual sin abortar test completo.

---

### 4.2 Scenarios con Pesos (Weighted Scenarios)
**Herramientas:** Gatling `scenario.inject(...).andThen(...)`, k6 scenarios con executor distribution

**Problema:**
- En Relampo, todos los scenarios se ejecutan en paralelo
- No se puede definir "80% usuarios tipo A, 20% usuarios tipo B"

**Gatling Example:**
```scala
setUp(
  readHeavyUsers.inject(rampUsers(80) during(60 seconds)),
  writeHeavyUsers.inject(rampUsers(20) during(60 seconds))
)
```

**Estado en Relampo:**
```yaml
scenarios:
  - name: "Read Heavy"
    load:
      users: 80  # Manual - usuario debe calcular
  
  - name: "Write Heavy"
    load:
      users: 20
```

**Limitación:** Usuario debe calcular manualmente el split de usuarios.

**Recomendación:** 🔴 Agregar `weight` a scenarios:
```yaml
scenarios:
  - name: "Read Heavy"
    weight: 80  # 80% de carga total
    load:
      type: ramp
      users: auto  # Engine calcula basado en weight
      duration: 5m
  
  - name: "Write Heavy"
    weight: 20  # 20% de carga total
    load:
      type: ramp
      users: auto
      duration: 5m

# Configuración global de usuarios totales
test:
  total_users: 100  # Engine distribuye: 80 para Read, 20 para Write
```

**Beneficio:** Más fácil modelar user behavior distribution realista.

---

### 4.3 Open Workload Model (Rate-Based)
**Herramientas:** k6 `constant-arrival-rate`, Gatling `constantUsersPerSec`

**Problema:**
- Relampo solo soporta Closed Model (N VUs fijos)
- En Open Model, se generan VUs dinámicamente para mantener rate constante

**Diferencia:**
- **Closed Model**: 100 VUs → cada uno ejecuta requests lo más rápido posible
- **Open Model**: 100 req/s → se crean VUs necesarios para mantener esa tasa

**k6 Example:**
```javascript
export const options = {
  scenarios: {
    open_model: {
      executor: 'constant-arrival-rate',
      rate: 100,     // 100 req/s
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,  // Estimación inicial
      maxVUs: 200           // Límite superior
    }
  }
};
```

**Estado en Relampo:**
```yaml
# Solo closed model
scenarios:
  - load:
      type: constant
      users: 100  # VUs fijos
      duration: 5m
```

**Recomendación:** 🔴 Agregar `load.type: open`:
```yaml
scenarios:
  - load:
      type: open  # Nuevo load type
      rate: 100   # 100 requests/segundo
      duration: 5m
      max_users: 200  # Límite de VUs concurrentes
```

**Beneficio:** Modelar sistemas con arrival rate constante (e.g. APIs públicas).

---

### 4.4 Rendezvous Point / Synchronization
**Herramientas:** JMeter Synchronizing Timer, Gatling `rendezVous()`

**Problema:**
- No hay forma de hacer que N VUs esperen entre sí antes de continuar
- Útil para simular "Black Friday" spike (todos empiezan al mismo tiempo)

**JMeter Example:**
```xml
<SyncTimer>
  <intProp name="groupSize">100</intProp>
  <longProp name="timeoutInMs">10000</longProp>
</SyncTimer>
```

**Gatling Example:**
```scala
exec(rendezVous(100))  // Esperar 100 usuarios
```

**Estado en Relampo:**
```yaml
# No existe - VUs son independientes
scenarios:
  - load:
      users: 100
    steps:
      - get: /api/flash-sale  # Cada VU ejecuta cuando puede
```

**Recomendación:** 🔴 Agregar `sync_point` step:
```yaml
scenarios:
  - load:
      users: 100
    steps:
      - sync_point:
          wait_for: 100  # Esperar 100 VUs
          timeout: 10s   # Timeout si no llegan todos
      
      - post: /api/flash-sale/purchase  # Todos ejecutan juntos
```

**Beneficio:** Simular cargas extremas coordinadas.

---

### 4.5 Ramp Down (Graceful Shutdown)
**Herramientas:** Gatling `rampDown`, k6 graceful stop

**Problema:**
- Relampo solo tiene `ramp_up` (subida gradual)
- No hay `ramp_down` (bajada gradual)

**Gatling Example:**
```scala
setUp(
  scn.inject(
    rampUsers(100) during(1 minute),   // Ramp up
    constantUsersPerSec(100) during(10 minutes),
    rampUsersPerSec(100, 0) during(1 minute)  // Ramp down
  )
)
```

**Estado en Relampo:**
```yaml
scenarios:
  - load:
      type: constant
      users: 100
      duration: 10m
      ramp_up: 1m
      # ramp_down no existe - VUs se detienen abruptamente
```

**Recomendación:** ⚠️ Agregar `ramp_down`:
```yaml
scenarios:
  - load:
      type: constant
      users: 100
      duration: 10m
      ramp_up: 1m
      ramp_down: 1m  # Bajada gradual al final
```

**Beneficio:** Evitar detención abrupta que puede causar errores artificiales.

---

### 4.6 Custom Metrics API Mejorada
**Herramientas:** k6 `Trend`, `Counter`, `Gauge`, `Rate`

**Problema:**
- Relampo tiene `custom_metrics` básico en `metrics`
- No hay API para crear/incrementar métricas desde `spark` scripts

**k6 Example:**
```javascript
import { Counter, Trend } from 'k6/metrics';

const loginAttempts = new Counter('login_attempts');
const cartSize = new Trend('cart_size');

export default function() {
  loginAttempts.add(1);
  
  const res = http.get('/cart');
  cartSize.add(res.json().items.length);
}
```

**Estado en Relampo:**
```yaml
# Solo declaración estática
metrics:
  custom_metrics:
    - cart_items_avg

# No se puede poblar desde spark
scenarios:
  - steps:
      - get: /api/cart
        spark:
          - when: after
            script: |
              // ❌ No existe API
              // metrics.track("cart_items_avg", response.json().items.length);
```

**Recomendación:** ⚠️ Agregar API de metrics en spark context:
```yaml
scenarios:
  - steps:
      - get: /api/cart
        spark:
          - when: after
            script: |
              // Nuevo API
              metrics.track("cart_items_avg", response.json().items.length);
              metrics.increment("total_cart_views");
              metrics.gauge("current_cart_size", response.json().items.length);

metrics:
  custom_metrics:
    - name: cart_items_avg
      type: trend  # avg, min, max, p50, p95, p99
    - name: total_cart_views
      type: counter
    - name: current_cart_size
      type: gauge
```

**Beneficio:** Business metrics personalizadas (conversión, revenue, etc).

---

### 4.7 WebSocket Support
**Herramientas:** k6 `ws.connect()`, Gatling `ws("name").connect(url)`

**Problema:**
- Relampo v1 solo soporta HTTP
- WebSocket es protocolo diferente (bi-direccional, long-lived)

**k6 Example:**
```javascript
export default function() {
  const ws = ws.connect('ws://example.com/socket', function(socket) {
    socket.on('open', () => socket.send('Hello'));
    socket.on('message', (msg) => console.log(msg));
  });
}
```

**Estado en Relampo:**
```yaml
# ❌ No existe
scenarios:
  - steps:
      - get: /api/endpoint  # Solo HTTP
```

**Recomendación:** 🔴 Agregar `websocket` step (para v2.0):
```yaml
scenarios:
  - steps:
      - websocket:
          url: "ws://example.com/socket"
          connect_timeout: 5s
          on_open:
            send: '{"type": "subscribe", "channel": "trades"}'
          on_message:
            extract:
              last_price: $.data.price
          duration: 30s
          on_close:
            send: '{"type": "unsubscribe"}'
```

**Nota:** Fuera de scope para v1 (diferente paradigma de testing).

---

### 4.8 gRPC Support
**Herramientas:** k6 `grpc.connect()`, Gatling `grpc("name")`

**Problema:**
- Relampo v1 solo soporta HTTP REST
- gRPC requiere Protocol Buffers, streaming, etc.

**k6 Example:**
```javascript
import grpc from 'k6/net/grpc';

export default function() {
  const client = new grpc.Client();
  client.load(['definitions'], 'service.proto');
  client.connect('localhost:50051');
  
  const response = client.invoke('Service/Method', { field: 'value' });
}
```

**Recomendación:** 🔴 Agregar `grpc` step (para v2.0+):
```yaml
scenarios:
  - steps:
      - grpc:
          service: "UserService"
          method: "GetUser"
          proto: "protos/user.proto"
          request:
            user_id: 123
          extract:
            user_name: $.name
```

**Nota:** Requiere proto parser, fuera de scope para v1.

---

### 4.9 Constant Throughput Timer (Engine-Level Pacing)
**Herramientas:** JMeter Constant Throughput Timer

**Problema:**
- Workaround actual con `think_time` manual no garantiza throughput exacto
- Engine debería ajustar dinámicamente

**JMeter Example:**
```xml
<ConstantThroughputTimer>
  <intProp name="calcMode">0</intProp>  <!-- This thread only -->
  <doubleProp name="throughput">600.0</doubleProp>  <!-- 600/min = 10/s -->
</ConstantThroughputTimer>
```

**Recomendación:** Cubierto por `load.type: open` (4.3) o `target_rps` (3.5).

---

## 5. ⛔ Elementos Fuera de Scope

### 5.1 Programación Imperativa Completa
**Herramientas:** JMeter Groovy scripts, k6 JavaScript completo

**Por qué NO incluir:**
- Viola diseño declarativo de Relampo
- YAML debe ser legible y portable
- `spark` scripts ya permiten lógica necesaria

**Ejemplo de lo que NO hacer:**
```yaml
# ❌ Mal - código imperativo completo
- spark:
    script: |
      for (let i = 0; i < 100; i++) {
        if (Math.random() > 0.5) {
          http.get(`/api/item/${i}`);
        } else {
          http.post(`/api/item/${i}`, {data: i});
        }
      }
```

**Recomendación:** Mantener `spark` limitado a transformaciones de datos.

---

### 5.2 Callbacks Complejos y DSLs
**Herramientas:** Gatling Scala DSL

**Gatling Example:**
```scala
exec(
  asLongAs(session => session("counter").as[Int] < 100) {
    exec(http("request").get("/api"))
      .pause(1)
      .exec(session => session.set("counter", session("counter").as[Int] + 1))
  }
)
```

**Por qué NO incluir:**
- YAML no es lenguaje de programación
- Callbacks requieren runtime complejo
- `loop` con `break_on` cubre casos comunes

---

### 5.3 Dynamic Scenario Generation
**Herramientas:** k6 scenarios generados en código

**k6 Example:**
```javascript
export const options = {
  scenarios: {}
};

// Generar scenarios dinámicamente
for (let i = 0; i < 10; i++) {
  options.scenarios[`scenario_${i}`] = {
    executor: 'constant-vus',
    vus: 10,
    duration: '1m'
  };
}
```

**Por qué NO incluir:**
- YAML es estático por definición
- Generación dinámica requiere pre-procesamiento externo

---

### 5.4 Shared State Complejo Entre VUs
**Herramientas:** JMeter `setProperty()`/`getProperty()` entre threads

**Por qué NO incluir:**
- Requiere coordinación compleja en engine
- `data_source: shared` cubre caso común (CSV compartido)
- Shared state introduce race conditions

---

### 5.5 Browser/Real User Monitoring
**Herramientas:** k6 browser, Playwright, Selenium

**k6 Browser Example:**
```javascript
import { browser } from 'k6/experimental/browser';

export default async function() {
  const page = browser.newPage();
  await page.goto('https://example.com');
  await page.click('#login-button');
}
```

**Por qué NO incluir:**
- Paradigma completamente diferente (protocol-level vs browser-level)
- Relampo v1 es protocol-level tool
- Browser testing requiere Chromium/Puppeteer dependencies

---

### 5.6 Distributed Testing Built-in
**Herramientas:** JMeter Distributed Mode, Gatling Enterprise

**Por qué NO incluir:**
- Requiere orchestration layer (Master/Slave nodes)
- Fuera de scope del formato YAML
- Debe manejarse a nivel de infraestructura/platform

---

## 6. Resumen de Prioridades

### 🔴 CRÍTICO - Agregar en v1.1 (Q1 2026)

| # | Elemento | Beneficio | Complejidad |
|---|----------|-----------|-------------|
| 1 | **scenarios[].weight** | User behavior realista | Baja |
| 2 | **load.type: open** | Rate-based testing | Media |
| 3 | **checks vs assert** | Soft validations + thresholds | Media |
| 4 | **sync_point** | Spike testing coordinado | Media |
| 5 | **load.ramp_down** | Graceful shutdown | Baja |

### ⚠️ IMPORTANTE - Considerar para v1.2 (Q2 2026)

| # | Elemento | Beneficio | Complejidad |
|---|----------|-----------|-------------|
| 6 | **foreach** | Iterar arrays | Baja |
| 7 | **weighted step** | Random con pesos | Baja |
| 8 | **group.sla** | Transaction thresholds | Baja |
| 9 | **target_rps** | Throughput control | Media |
| 10 | **metrics API en spark** | Business metrics | Media |
| 11 | **múltiples data_sources** | Parametrización avanzada | Media |

### 🟢 NICE TO HAVE - v2.0 (Q3-Q4 2026)

| # | Elemento | Beneficio | Complejidad |
|---|----------|-----------|-------------|
| 12 | **modules/include** | Reutilización (viola "sin refs") | Alta |
| 13 | **websocket** | Testing real-time apps | Alta |
| 14 | **grpc** | Testing microservices | Alta |
| 15 | **Browser testing** | E2E completo | Muy Alta |

---

## 7. Decisiones de Diseño Pendientes

### 7.1 Módulos Reutilizables
**Pregunta:** ¿Permitir referencias externas (`include: file.yaml`) o solo inline (`modules:`)?

**Opciones:**
- **A) Solo inline**: Mantiene YAML auto-contenido, pero puede ser verboso
- **B) Include externo**: Más DRY, pero viola principio de portabilidad

**Recomendación:** Empezar con inline (A), evaluar feedback.

---

### 7.2 Open Model - Pre-allocated VUs
**Pregunta:** ¿Cómo manejar límites de VUs en open model?

**Opciones:**
- **A) Auto-scaling ilimitado**: Engine crea VUs sin límite (riesgo de OOM)
- **B) max_users obligatorio**: Usuario define límite superior
- **C) Estimación automática**: Engine estima basado en duración esperada

**Recomendación:** Opción B (max_users obligatorio) para seguridad.

---

### 7.3 Checks - Default Behavior
**Pregunta:** ¿Qué pasa si un check falla?

**Opciones:**
- **A) Siempre continuar**: Check failed se registra, test continúa (k6 style)
- **B) Configurable**: `on_check_failed: continue|abort`
- **C) Basado en threshold**: Solo falla test si rate < threshold

**Recomendación:** Opción A (siempre continuar) + C (threshold global).

---

## 8. Ejemplos de Implementación

### Ejemplo 1: Weighted Scenarios con Ramp Down
```yaml
test:
  name: "E-commerce Mixed Workload"
  total_users: 100

scenarios:
  - name: "Browsers (Read Heavy)"
    weight: 70  # 70 VUs
    load:
      type: ramp
      users: auto
      duration: 10m
      ramp_up: 2m
      ramp_down: 1m
    steps:
      - get: /api/products
      - think_time: 3s
      - get: /api/product/{{$random_int(1, 1000)}}

  - name: "Buyers (Write Heavy)"
    weight: 30  # 30 VUs
    load:
      type: ramp
      users: auto
      duration: 10m
      ramp_up: 2m
      ramp_down: 1m
    steps:
      - post: /api/cart/add
      - post: /api/checkout
```

### Ejemplo 2: Checks con Thresholds
```yaml
test:
  name: "API Health Check"

checks:
  - id: status_ok
    condition: "{{status}} >= 200 && {{status}} < 300"
  - id: fast_response
    condition: "{{response_time}} < 500"
  - id: valid_json
    condition: "{{body}} contains 'success'"

scenarios:
  - steps:
      - get: /api/health
        checks:
          - status_ok
          - fast_response
          - valid_json

metrics:
  thresholds:
    checks_passed_rate: 0.98  # 98% de checks deben pasar
    response_time_p95: 800
```

### Ejemplo 3: Open Model con Sync Point
```yaml
test:
  name: "Black Friday Flash Sale"

scenarios:
  - name: "Flash Sale Spike"
    load:
      type: open
      rate: 500  # 500 req/s
      duration: 5m
      max_users: 1000
    
    steps:
      # Warm up individual
      - get: /api/products/flash-sale
      
      # Esperar que 500 usuarios lleguen
      - sync_point:
          wait_for: 500
          timeout: 30s
      
      # Todos compran al mismo tiempo
      - post: /api/purchase
        body:
          product_id: "FLASH_DEAL_001"
        
        # Soft checks
        checks:
          - id: purchase_success
            condition: "{{status}} == 200"
        
        # Custom metric
        spark:
          - when: after
            script: |
              if (response.json().success) {
                metrics.increment("successful_purchases");
              }

metrics:
  thresholds:
    successful_purchases_rate: 0.80  # 80% conversión mínima
    response_time_p99: 5000
```

### Ejemplo 4: ForEach con Custom Metrics
```yaml
test:
  name: "Multi-Item Cart Processing"

variables:
  cart_items:
    - {id: 101, name: "Laptop"}
    - {id: 102, name: "Mouse"}
    - {id: 103, name: "Keyboard"}

scenarios:
  - steps:
      # Agregar cada item al carrito
      - foreach:
          var: item
          in: "{{cart_items}}"
          steps:
            - post: /api/cart/add
              body:
                product_id: "{{item.id}}"
              
              spark:
                - when: after
                  script: |
                    metrics.track("cart_add_time", response.time);
      
      # Checkout del carrito completo
      - post: /api/cart/checkout
        spark:
          - when: after
            script: |
              const total = response.json().total;
              metrics.track("order_value", total);

metrics:
  custom_metrics:
    - name: cart_add_time
      type: trend
    - name: order_value
      type: trend
```

---

## 9. Conclusiones

### 9.1 Estado Actual de Relampo v1
✅ **Fortalezas:**
- Protocolo HTTP completo y bien diseñado
- Load models cubren casos comunes (constant, ramp, spike, step)
- Control de flujo robusto (if, loop, group, retry)
- Data sources flexibles (CSV, JSON)
- Scripting con `spark` para extensibilidad

🔴 **Gaps Críticos:**
1. Falta load model `open` (rate-based)
2. No hay soft checks con thresholds
3. Scenarios no tienen pesos (user distribution)
4. No hay sync points para spike testing
5. Falta ramp down para graceful shutdown

### 9.2 Recomendación de Roadmap

**v1.1 (1-2 meses):**
- Agregar 5 elementos críticos marcados con 🔴
- Foco en feature parity con k6/Gatling para load testing

**v1.2 (3-4 meses):**
- Agregar elementos importantes marcados con ⚠️
- Mejorar experiencia de usuario (foreach, weighted, metrics API)

**v2.0 (6+ meses):**
- Evaluar protocolos adicionales (WebSocket, gRPC)
- Considerar módulos/includes (con cuidado en diseño)
- Advanced features basadas en feedback de usuarios

### 9.3 Competitividad vs Herramientas Establecidas

**vs JMeter:**
- ✅ Mejor: Sintaxis declarativa, versionable, más simple
- ✅ Mejor: Built-in functions, data sources modernos
- 🟡 Igual: HTTP protocol coverage
- 🔴 Peor: No hay GUI recorder, menos timers/samplers

**vs k6:**
- ✅ Mejor: Accesible para no-programadores (YAML vs JavaScript)
- 🟡 Igual: Load models similares
- 🔴 Peor: Falta open model, checks/thresholds, custom metrics API

**vs Gatling:**
- ✅ Mejor: No requiere conocer Scala, sintaxis más simple
- 🟡 Igual: Scenario composition, assertions
- 🔴 Peor: Falta weighted scenarios, feeders avanzados

**Conclusión:**
Relampo v1 es competitivo para HTTP REST API testing básico a intermedio. Con v1.1 (agregando elementos críticos), alcanzaría feature parity con k6/Gatling para mayoría de casos de uso.

---

## 10. Referencias

- JMeter User Manual: https://jmeter.apache.org/usermanual/
- k6 Documentation: https://k6.io/docs/
- Gatling Documentation: https://gatling.io/docs/
- Relampo YAML v1 Spec: `RELAMPO_YAML_V1_SPEC.md`

---

**Documento creado:** Febrero 2026  
**Próxima revisión:** Post v1.1 release
