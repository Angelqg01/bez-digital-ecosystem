# Alta y despliegue asistidos por IA a través del MCP

*Cómo un cliente —o un prospecto que aún no lo es— se da de alta, instala el
SDK, integra su ERP, levanta un nodo y configura su cuenta bancaria hablando con
su propia IA, sin salir de ella y sin aprender nuestro panel.*

> Tercera pieza de la serie. Las otras dos:
> [`BEZHAS_MCP_ESTRATEGIA_CLIENTE.md`](BEZHAS_MCP_ESTRATEGIA_CLIENTE.md) (arquitectura y producto)
> y [`BEZHAS_MCP_GUIA_INTEGRACION.md`](BEZHAS_MCP_GUIA_INTEGRACION.md) (uso de cara al cliente).

---

## 0. La idea, y el matiz que la hace viable

**La idea.** Hoy, entrar en BeZhas es: web → registro → verificación → panel →
buscar la clave → leer documentación → instalar → configurar → soporte. Ocho
pasos y dos días. La propuesta es que sea **una conversación**:

> *"Somos una transitaria de 40 personas en Algeciras, trabajamos con SAP
> Business One. Quiero probar BeZhas para trazabilidad de contenedores."*

y que el agente conduzca todo lo demás: recomendar plan, abrir el alta,
instalar el SDK, generar la integración con el Business One, levantar un nodo si
hace falta y dejar la cuenta bancaria configurada.

**El matiz, y es el que decide el diseño entero:** el agente **conduce** el
proceso, pero **no toca** ni el dinero, ni las credenciales, ni el sistema del
cliente. Todo lo sensible ocurre en una pantalla de BeZhas que se abre desde el
chat con un clic, y el agente sólo sabe si ha terminado o no.

No es una limitación que nos ponemos por prudencia. Es que la alternativa —que
el IBAN o la api-key pasen por el mensaje— los mete en el contexto de un modelo
de un tercero, en el historial de chat del cliente y en nuestros logs de
petición. Tres sitios donde no deben estar, y ninguno de los tres se puede
borrar después.

```
   Cliente  ─────────►  su IA  ─────────►  MCP BeZhas
                          │                    │
                          │  devuelve URL      │  crea sesión de onboarding
                          │  efímera + estado  │  (token opaco, 15 min)
                          ▼                    ▼
                  ┌────────────────────────────────┐
                  │  Pantalla alojada por BeZhas   │
                  │  onb.bez.digital/o/<token>     │
                  │  Aquí —y sólo aquí— la persona │
                  │  escribe lo sensible           │
                  └────────────────────────────────┘
                          │
                          ▼  el agente sondea: ¿listo?
                     sigue la conversación
```

---

## 1. Las tres formas de sacar una pantalla, y cuándo usar cada una

Un servidor MCP puede pedir datos al usuario de tres maneras. No son
intercambiables y confundirlas es el error clásico de este diseño.

| # | Mecanismo | Dónde aparece | Soporte | Para qué SÍ | Para qué NO |
|---|---|---|---|---|---|
| 1 | **Elicitation** (`elicitation/create`, spec MCP) | formulario dentro del chat | desigual entre clientes | sector, nº de empleados, país, ERP que usa | nada sensible |
| 2 | **Recurso de interfaz embebido** (patrón *widget*) | panel dentro del chat | sólo clientes que lo implementan | elegir plan, ver progreso, confirmar resumen | nada sensible |
| 3 | **Pantalla alojada con token efímero** | pestaña/popup del navegador | **siempre funciona** | IBAN, KYB, documentos, credenciales, firma | — |

**Regla de degradación:** todo flujo se diseña primero para el nivel 3 y luego,
si el cliente lo soporta, se *adorna* con 1 y 2. Un onboarding que sólo funciona
en un cliente de chat concreto es un onboarding que no funciona.

**Regla de sensibilidad:** los niveles 1 y 2 son para datos que no pasa nada
porque acaben escritos en un chat. El nivel 3 es para todo lo demás, sin
excepciones ni atajos "porque este cliente es de confianza".

### La primitiva ya existe en el repositorio

`api/routes/checkout.js` ya hace exactamente esto para pagos: página
server-rendered y autocontenida, con token opaco en la URL, que sondea un
endpoint público de estado hasta que la operación se resuelve. Montada en `/c`.

**El onboarding es ese mismo patrón aplicado a cinco flujos más.** No hay que
inventar nada: hay que generalizar `/c` a `/o` y reutilizar el diseño de la
página. Eso ahorra la mitad del trabajo y, más importante, evita tener dos
mecanismos distintos de pantalla alojada que diverjan con el tiempo.

---

## 2. El problema nuevo: el prospecto no tiene api-key

Todo el MCP actual vive detrás de `authenticateApp`. Pero quien se está dando de
alta **todavía no es cliente**: no tiene clave, no tiene organización, no tiene
scopes. Si el alta exige una clave, no hay alta asistida.

Hace falta, por tanto, una **clase de autenticación nueva**: un puñado muy corto
de herramientas invocables sin credencial. Es superficie pública en internet
llamable por un bot, así que se acota en serio:

1. **Cinco herramientas y ninguna más**: `bezhas_intro`, `bezhas_recommend_plan`,
   `bezhas_signup_start`, `bezhas_connect_start`, `bezhas_onboarding_status`.
2. **Ninguna lee ni escribe datos de negocio.** Crean una sesión de onboarding y
   devuelven una URL. Nada más.
3. **Límite por IP mucho más duro** que el de cliente (10/min frente a 120), y
   límite global de sesiones creadas por hora.
4. **La verificación humana vive en la pantalla alojada**, no en la herramienta:
   el bot puede crear una sesión, pero no puede completarla.
5. **Sesión de 15 minutos y de un solo uso.** Caducada, se pide otra.
6. **Registro separado.** El tráfico anónimo no se mezcla con el de clientes en
   los mismos contadores: si se abusa, se corta el canal anónimo sin tocar el
   servicio de quien paga.

En código, esto es un router hermano de `mcp-gateway.js` —mismo transporte,
misma forma de envolver respuestas— pero con `authenticateApp` sustituido por un
middleware anónimo con su propio limitador. **No se toca el existente**: mezclar
en un mismo router lo autenticado y lo anónimo es exactamente cómo se acaba
sirviendo por error una herramienta de cliente a un desconocido.

---

### 2.1 Lo que corre antes de saber quién llama

Sin credencial que exigir, todo lo que va por delante del handler —parser de
JSON, transporte del SDK, deserialización del sobre JSON-RPC— queda al alcance
de cualquiera. No hay ningún fallo conocido en esas piezas; la postura es que un
fallo *futuro* en ellas no deba ser alcanzable sin credencial más de lo
imprescindible. De ahí cinco recortes, todos anteriores al SDK:

| Recorte | Por qué |
|---|---|
| Cuerpo de 32 KB con parser propio | el global de la API son 10 MB, pensados para subir documentos **con sesión iniciada**; un sobre JSON-RPC no llega a 1 KB |
| Sin lotes JSON-RPC | un array multiplica el trabajo de UNA petición, y el limitador cuenta peticiones |
| Lista blanca de métodos del protocolo | de todo lo que el SDK atiende, aquí sólo tienen sentido cinco |
| Tiempo máximo por petición | el servidor y el transporte se crean por llamada; una colgada es memoria retenida |
| Protección contra DNS rebinding | cuando hay hosts configurados |

El primero obliga a montar este router **antes** de `express.json()` en
`api/index.js`: si se monta después, el cuerpo ya viene analizado con el límite
global y el recorte no sirve de nada.

---

## 3. Los flujos

Cada uno con el mismo esquema: qué pide el cliente, qué herramientas entran, qué
ocurre en la pantalla alojada y dónde está la línea que el agente no cruza.

### 3.0 Conectar una cuenta existente (login)

**Lo que dice el cliente:**
> *"Ya trabajamos con BeZhas. Conéctame esta IA a nuestra cuenta."*

```
bezhas_connect_start({ entorno, organizacion? })
  → { onboardingId, url, caduca, pasos: [...] }
```

En la pantalla: la persona inicia sesión con su cuenta de BeZhas, elige
organización y entorno, autoriza el conector y **copia la credencial a su gestor
de secretos**.

**La línea, y aquí es la más estricta de todas:** la credencial **no vuelve por
el MCP**. El agente se entera de que la sesión pasó a `completado` y de nada
más. Si la clave viajara en la respuesta de una herramienta acabaría en el
contexto del modelo y en el historial del chat, y daría igual lo bien hecho que
estuviera el resto del sistema.

Es el caso más frecuente en la práctica —alguien nuevo en el equipo, un cambio
de IA, el conector en otro equipo— y sin él esa persona tenía que salir del
chat, buscar el panel y copiar una clave a mano: justo el recorrido que esto
viene a eliminar.

---

### 3.1 Alta según perfil

**Lo que dice el cliente:**
> *"Somos una transitaria de 40 personas en Algeciras, con SAP Business One.
> Queremos trazabilidad de contenedores. ¿Qué necesitamos?"*

**Herramientas:**

```
bezhas_intro()
  → qué es la plataforma, qué SubApps hay, qué se puede hacer sin ser cliente.
    Sirve para que el agente no improvise nuestra propuesta de valor.

bezhas_recommend_plan({ sector, empleados, pais, erp?, caso_de_uso })
  → plan recomendado, SubApps que encajan, scopes que necesitaría,
    coste estimado mensual y qué exige el caso de uso (KYB, DPA, nodo).
    NO crea nada. Es una recomendación consultable sin compromiso.

bezhas_signup_start({ perfil })
  → { onboardingId, url, expiraEn, pasos: [...] }
    Crea la sesión y devuelve el enlace. NO da de alta a nadie.
```

**En la pantalla alojada:** el formulario llega **precargado** con todo lo que el
agente ya sabe (razón social, sector, empleados, país, ERP, plan sugerido). La
persona revisa, corrige lo que haga falta, acepta condiciones —la aceptación de
términos la hace una persona, nunca un agente—, verifica su correo y firma el
DPA si va a conectar el ERP.

**La línea:** el agente prepara y explica; **la persona acepta**. Aceptar
condiciones contractuales es un acto jurídico, y un agente no es parte del
contrato.

**Reutiliza:** `POST /organizations`, `POST /:orgId/kyb/submit` y el flujo de
documentos que ya existen en `api/routes/organizations.js`.

---

### 3.2 Instalación del SDK

**Lo que dice el cliente:**
> *"Instálame el SDK en el servidor de facturación."*

Aquí hay que separar dos mundos, porque la respuesta correcta es distinta:

**Caso A — el cliente usa un agente con terminal** (Claude Code, Cursor,
Antigravity sobre su propio equipo). El agente **sí** puede instalar, porque
está en la máquina del cliente y bajo su permiso. Nosotros no ejecutamos nada:
le damos el plan y el material verificable.

```
bezhas_sdk_install_plan({ entorno, gestor, lenguaje })
  → { paquete: "@bezhas/sdk@3.0.0",
      comando: "pnpm add @bezhas/sdk",
      integridad: "sha512-…",          ← se compara antes de confiar
      config_ejemplo: {...},
      verificacion: "node -e \"…\"",
      credenciales_url: "https://onb.bez.digital/o/<token>" }
```

**La credencial nunca viaja en la respuesta de la herramienta.** El agente
instala el paquete y escribe la configuración con un hueco; la api-key la obtiene
la persona en la pantalla alojada y la pega en su gestor de secretos. Si el
agente tiene acceso al gestor de secretos del cliente, que la escriba ahí — pero
el valor sale de la pantalla, no del chat.

**Caso B — el cliente sólo tiene chat** (Claude.ai, ChatGPT). El agente no
ejecuta nada. La pantalla alojada genera el comando exacto para su sistema
operativo y gestor de paquetes, con un botón de copiar, y muestra la
comprobación que debe salir bien. El agente acompaña e interpreta el resultado
que la persona le pegue de vuelta.

**Lo que no hacemos nunca:** un `curl … | bash` apuntando a un dominio nuestro.
Es cómodo y es exactamente el patrón que convierte un compromiso de nuestro
servidor en ejecución remota en todos los servidores de nuestros clientes. Se
distribuye por registro de paquetes, con versión fijada y hash verificable.

---

### 3.3 Integración con la plataforma de gestión

**Lo que dice el cliente:**
> *"Conéctalo con nuestro SAP Business One para que las facturas de proveedor
> lleguen a BeZhas Pay."*

```
bezhas_erp_integration_plan({ erp, version, casos: ['facturas_proveedor'] })
  → { adaptador, objetos_implicados, campos_minimos, permisos_que_pedir,
      modo: 'agente' | 'gestionado', pasos: [...], andamiaje?: {...} }
```

Dos modos, según el documento de estrategia (§4):

- **Modo agente (por defecto).** El agente del cliente tiene los dos conectores
  —el nuestro y el de su ERP— y escribimos el pegamento en su lado. Con un
  agente con terminal, el `andamiaje` es código listo para su repositorio.
  **Nosotros nunca vemos credenciales del ERP.**
- **Modo gestionado (Business+).** BeZhas mantiene la conexión servidor a
  servidor. Aquí sí hay credencial del ERP en juego, y por eso entra **entera**
  por la pantalla alojada: usuario de servicio y alcance de campos se eligen en
  una pantalla que el agente no ve, y el DPA tiene que estar firmado antes de
  que el formulario se abra siquiera.

**La línea:** el agente propone el mapeo de campos y lo explica; **una persona
aprueba qué campos salen del ERP**. Un mapeo aprobado a ciegas es una fuga de
datos con conformidad aparente.

---

### 3.4 Instalación de nodos

**Lo que dice el cliente:**
> *"Queremos nuestro propio nodo edge en el almacén."*

```
bezhas_node_requirements({ tipo: 'edge' | 'enterprise' })
  → CPU, RAM, disco, puertos, red, y si el plan lo permite.

bezhas_node_provision_start({ tipo, entorno })
  → { onboardingId, url, comando_docker, expiraEn }
```

Los dos artefactos existen ya: `bezhas-edge-node/` y `enterprise-node/`, ambos
con `Dockerfile`, así que el despliegue es una imagen y un fichero de entorno.

**La decisión que no se puede equivocar: las claves del nodo se generan EN LA
MÁQUINA DEL CLIENTE y su privada no sale de ahí jamás.** El arranque genera el
par, nos envía sólo la pública y un token de registro de un solo uso, y nosotros
damos de alta el nodo. Un flujo que generase el par en nuestro servidor y lo
"entregara" al cliente pondría la clave privada de todos los nodos en nuestros
logs y en el chat del cliente. Sería una puerta trasera, aunque no fuera la
intención.

**La línea:** el agente prepara el `docker-compose` y explica los puertos; la
persona lo ejecuta en su infraestructura. Nosotros no tenemos —ni queremos—
acceso a la máquina del cliente.

---

### 3.5 Datos bancarios

Este es el flujo que el cliente pide como *"rellenar los datos bancarios sin
entrar en la plataforma"*, y conviene explicar exactamente qué se le da, porque
se le da lo que quiere pero no de la forma que probablemente imagina.

```
bezhas_bank_setup_start({ proposito: 'cobros' | 'pagos' | 'ambos' })
  → { onboardingId, url, metodos: ['sepa_dd', 'transferencia', 'tarjeta'], expiraEn }

bezhas_onboarding_status({ onboardingId })
  → { estado: 'pendiente'|'en_curso'|'completado'|'caducado',
      paso_actual, siguiente_accion }
```

**Lo que el cliente evita, que es lo que de verdad le molesta:** buscar la web,
crear otra contraseña, navegar cuatro menús, encontrar la sección correcta y
volver al chat a contar qué ha hecho. Un clic desde la conversación, formulario
precargado con la razón social y el CIF que el agente ya ha recogido, y al
terminar el agente lo sabe y sigue.

**Lo que no ocurre, y no va a ocurrir:** que el IBAN se escriba en el chat. Ni
que el agente lo lea de un correo y lo rellene. Ni que viaje como argumento de
una herramienta MCP.

Las razones, en orden de gravedad:

1. **Acabaría en el contexto de un modelo de un tercero** (Anthropic, OpenAI,
   quien sea). Deja de estar bajo control del cliente y del nuestro.
2. **Quedaría en el historial de chat**, que se sincroniza entre dispositivos y
   sobrevive a la persona que lo escribió.
3. **Quedaría en logs de petición** — nuestros y de intermediarios.
4. **Es el objetivo predilecto de la inyección de prompt.** Un agente que sabe
   rellenar cuentas bancarias es un agente al que se le puede pedir, desde un
   PDF manipulado, que rellene otra. (Ver §9 de la guía de integración.)

Donde el dinero manda de verdad —domiciliación SEPA, verificación de
titularidad— el formulario lo sirve el proveedor de pagos (Stripe Financial
Connections o el mandato SEPA), no nosotros: así el número de cuenta tampoco
toca nuestros servidores. Nosotros guardamos la referencia del mandato.

> **Cómo contarlo al cliente sin sonar a excusa:** *"Se rellena en una pantalla
> que se abre desde el chat, ya con tus datos puestos. Lo único que escribes es
> el número de cuenta, y lo escribes tú, en una pantalla cifrada, porque ese
> dato no debe pasar por ninguna IA — ni por la tuya ni por la nuestra."*
> Bien explicado, esto **vende**: es la prueba de que el resto del sistema está
> pensado igual.

---

## 4. Qué hace falta construir

| Pieza | Dónde | Notas |
|---|---|---|
| Router MCP anónimo | `api/routes/mcp-public.js` | hermano de `mcp-gateway.js`, sin `authenticateApp`, limitador propio |
| Catálogo de onboarding | `api/config/mcp-onboarding-tools.js` | lista blanca separada; nunca se mezcla con la de cliente |
| Sesiones de onboarding | `api/services/onboardingSession.js` | token opaco, 15 min, un uso, estado sondeable |
| Pantallas alojadas | `api/routes/onboarding-pages.js`, montado en `/o` | mismo patrón y estilo que `/c` |
| Tabla | `api/db/migrations/052_onboarding_sessions.sql` | id, tipo, payload precargado, estado, caducidad, ip origen |
| Endpoint público de estado | `/api/gateway/v1/onboarding/:token` | sin datos sensibles en la respuesta |
| Catálogo de requisitos de nodo | `api/config/node-profiles.js` | dimensionado por tipo y plan |
| Plan de integración por ERP | `api/services/erp/*Adapter.js` | comparte adaptadores con el modelo gestionado |

Orden sensato de construcción: **sesiones + pantallas alojadas primero** (es la
mitad del trabajo y lo usan los cinco flujos), luego el router anónimo con alta y
recomendación de plan, luego SDK y banco, y por último ERP y nodos, que dependen
de piezas que aún no existen.

---

## 5. Lo que hay que decidir antes de escribir código

Cinco preguntas cuya respuesta cambia el diseño, no el acabado:

1. **¿El MCP anónimo se publica en directorios de conectores?** Si sí, cualquiera
   lo añade y el volumen de sesiones basura sube en un orden de magnitud. Si no,
   el enlace lo damos nosotros en el proceso comercial y el canal es más
   defendible pero deja de ser autoservicio real. Es una decisión de negocio.
2. **¿Quién puede dar de alta la organización?** Si la persona que habla con la
   IA no es apoderada, el alta queda pendiente de que alguien con firma la
   complete. Conviene resolverlo en la pantalla, no descubrirlo en el KYB.
3. **¿Prueba sin KYB?** Un sandbox inmediato sin verificación acelera muchísimo
   la adopción, y no expone nada si es sandbox de verdad. Recomendado.
4. **¿Qué pasa si el agente abandona a medias?** Sesión caducada a los 15
   minutos y un correo con el enlace para retomar. Sin eso, cada duda del cliente
   es un alta perdida.
5. **¿Idioma y jurisdicción?** El país sale del perfil y determina IVA, régimen y
   qué DPA se firma. Mejor recogerlo en el primer minuto que corregirlo después.

---

## 6. Riesgos

- **Superficie pública sin autenticar.** Es el cambio de exposición más grande
  que hemos hecho: hasta hoy, sin api-key no hay MCP. Los recortes de §2.1
  acotan lo alcanzable —cuerpo, lotes, métodos, tiempo—, pero **no sustituyen a
  una revisión de seguridad propia** antes de publicarse. Conviene además fijar
  la versión del SDK de MCP y seguir sus avisos: es la dependencia que ahora
  corre antes de cualquier autenticación.
- **Suplantación en el alta.** Un agente puede afirmar cualquier razón social.
  Es el KYB quien resuelve, y por eso el sandbox no puede convertirse en
  producción sin pasar por él.
- **Falsa sensación de automatismo.** "La IA me lo instala" y luego hay que
  ejecutar un comando. Mejor prometer *acompañamiento* que *automatismo*: el
  cliente decepcionado en el minuto tres no llega al minuto diez.
- **Coste de soporte desplazado.** Si el agente conduce el alta, los fallos
  llegan descritos por un modelo, no por la persona. Los mensajes de error de las
  herramientas de onboarding tienen que ser accionables por un humano que no ha
  visto la conversación.
- **Dependencia del proveedor de pagos** para el flujo bancario. Es deliberada:
  el dato de cuenta no lo queremos ni de paso.
