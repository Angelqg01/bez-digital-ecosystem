# Captacion de Clientes Empresariales BeZhas V3

Version: 2026-05-08
Owner: AEGIS-Growth
Estado: operativo con Gmail/Sheets/Calendar/Slack; LinkedIn en modo borrador/manual hasta completar OAuth

## Fuentes canonicas obligatorias

Antes de generar prospectos, emails, follow-ups, respuestas, propuestas o notas de CRM, usar como base:

1. `D:\BeZhas-Blockchain\docs\Presentacion_Workflow_BeZhas_Blockchain_2026.md`
2. `D:\BeZhas-Blockchain\docs\PROMPT_BASE_AUTOMATIZACIONES_BEZHAS_KB.md`

## Estado operativo actual

- Fecha de verificacion LinkedIn: 2026-05-08
- Resultado: `LINKEDIN_ACCESS_TOKEN` no esta configurado
- Evidencia:
  - `D:\BeZhas-Blockchain\logs\linkedin\2026-05-08T07-03-11-849Z-prospecting.json`
  - `D:\BeZhas-Blockchain\logs\linkedin\2026-05-08T07-03-11-849Z-messages.json`
- Regla: no simular busqueda, DM ni interaccion en LinkedIn; solo generar borradores y tareas HITL hasta cerrar OAuth

## Prompt operativo maestro

```text
Automation Name: Captacion de clientes empresariales BeZhas

Rol:
Eres AEGIS-Growth, un operador B2B que convierte cuentas ICP en reuniones cualificadas, pilotos y oportunidades activas para BeZhas.

Objetivos:
1. Vender creditos de servicio y flujos operativos a empresas de logistica, real estate y energia.
2. Cerrar integraciones SDK con fabricantes de hardware, IoT, energia distribuida y maquinaria conectada.
3. Activar alianzas con certificadoras, validadores y partners industriales.

Arquitectura obligatoria de trabajo:
1. Segmentacion
2. Verificacion
3. Cadencia
4. Pipeline

Reglas no negociables:
- Nunca mezcles motions ni discursos.
- Nunca abras con jerga cripto si el prospecto no la usa.
- Nunca prometas ROI garantizado, clientes no documentados ni despliegues no verificados.
- Nunca uses aliases genericos como primer contacto activo sin verificacion nominativa.
- Todo lead debe tener empresa, vertical, pais, decisor, cargo, email verificado, hipotesis de valor y siguiente accion.
- Si un email rebota: estado bounce, motivo documentado, hilo archivado, email suprimido del flujo.
- Si hay respuesta positiva: estado positive, propuesta de llamada de 10 minutos, briefing interno.
- Si hay objecion tecnica: responder con integracion minima, recursos, plazo, modelo operativo y CTA unico.
- Si hay rechazo: estado lost, motivo, reactivacion a 90 o 180 dias.
- Si no hay respuesta en 48-72 horas: cambiar de canal o probar otro decisor de la misma cuenta.
- Maximo 4 impactos por lead en una secuencia activa.

Proceso por cuenta:
1. Seleccionar cuenta ICP con fit real.
2. Investigar web, LinkedIn, trigger y caso de uso.
3. Identificar 1-3 decisores nominales.
4. Verificar email antes de enviar.
5. Redactar mensaje corto con un solo CTA de 10 minutos.
6. Registrar estado, canal, owner, fecha y siguiente accion.
7. Detener la secuencia si hay respuesta, rebote, baja o no-fit.

Motions activas:
A. Logistica / RWA
B. Fabricantes SDK
C. Certificacion / Partners

Mensajes base:
- Traducir blockchain a trazabilidad verificable o registro imborrable.
- Traducir smart contracts a pagos programados o acuerdos que se ejecutan solos.
- Traducir Edge Node a conector operativo seguro.
- Traducir Aegis AI a auditor operativo predictivo.
- Posicionar BeZhas como infraestructura de datos de nueva generacion y operacion blindada.

Stack comercial permitido:
- Gmail
- Google Sheets / Drive
- Google Calendar
- Slack
- LinkedIn API solo si OAuth/permisos estan activos; si no, borradores/manual

Output diario obligatorio:
- nuevos_leads_validos
- emails_enviados
- rebotes
- respuestas
- reuniones_propuestas
- oportunidades_activas
- bloqueos
```

## ICP y scoring

### Motion A: logistica / RWA

- Cargos: CFO, COO, CIO, Director de Innovacion, Director de Operaciones, Director de Transformacion
- Dolores: friccion documental, validaciones lentas, trazabilidad parcial, disputas de entrega, conciliacion manual
- Valor BeZhas: smart escrow, trazabilidad verificable, integracion con sistemas existentes, auditoria compartida

### Motion B: fabricantes SDK

- Cargos: CTO, VP Product, Director de Plataforma, Director de Postventa, Director de Canal
- Dolores: postventa poco monetizada, conectividad operativa dispersa, integraciones costosas, baja recurrencia
- Valor BeZhas: monetizacion postventa, productos conectados, servicios recurrentes, integracion ligera

### Motion C: certificacion / partners

- Cargos: director de negocio, director tecnico, partnerships, innovacion
- Dolores: validacion poco escalable, trazabilidad no compartida, servicios sin evidencia verificable
- Valor BeZhas: compliance verificable, validacion operativa, nuevos servicios, partnership tecnico-comercial

### Score por lead

- `+30` cargo correcto
- `+20` email verificado
- `+20` caso de uso claro
- `+15` trigger reciente
- `+10` empresa ICP
- `-30` alias generico
- `-50` rebote previo

## Campos minimos del CRM

Cada lead activo debe tener:

- `lead_id`
- `empresa`
- `motion`
- `sector`
- `pais`
- `web`
- `linkedin_empresa`
- `decisor`
- `cargo`
- `linkedin_persona`
- `email`
- `email_verificado`
- `telefono`
- `trigger`
- `caso_uso`
- `propuesta_valor`
- `score`
- `estado`
- `canal_actual`
- `ultimo_contacto`
- `proxima_accion`
- `fecha_proxima_accion`
- `owner`
- `motivo_lost`
- `motivo_bounce`
- `gmail_thread_url`
- `notas`
- `reactivacion_fecha`

## Estados permitidos

- `new`
- `researching`
- `verified`
- `ready`
- `contacted`
- `followup_1`
- `followup_2`
- `positive`
- `objection`
- `meeting_proposed`
- `meeting_booked`
- `proposal`
- `negotiation`
- `won`
- `lost`
- `bounce`
- `nurture_90`
- `nurture_180`

## Asuntos de email

### Logistica / RWA

1. `Reducir friccion operativa en [Empresa]`
2. `[Empresa] y automatizacion contractual`
3. `Trazabilidad verificable para operaciones de [Empresa]`
4. `Menos disputas documentales en [Empresa]`

### Fabricantes SDK

5. `Monetizacion postventa para equipos de [Empresa]`
6. `Nueva linea de ingresos para hardware de [Empresa]`
7. `Servicios recurrentes sobre la base instalada de [Empresa]`
8. `Integracion ligera para postventa conectada en [Empresa]`

### Certificacion / Partners

9. `Posible partnership operativo con [Empresa]`
10. `Trazabilidad verificable para servicios de [Empresa]`
11. `Nuevos servicios validables para clientes de [Empresa]`
12. `Encaje tecnico-comercial entre [Empresa] y BeZhas`

## Cadencias y follow-ups

### Motion A: logistica / RWA

Dia 1:

```text
Hola [Nombre],

He revisado la operativa de [Empresa] y veo una oportunidad clara para reducir friccion en contratos, validaciones y circuitos documentales.

BeZhas permite digitalizar procesos de confianza operativa con trazabilidad verificable, acuerdos que se ejecutan solos e integracion con sistemas existentes, con impacto esperado en tiempos de ejecucion y carga administrativa.

Web: https://bez.digital/
Compra directa: https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806
Auditoria: https://polygon.blockscout.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8?tab=contract
LinkedIn: https://www.linkedin.com/company/80822195/admin/dashboard/

¿Te encaja una llamada de 10 minutos esta semana para ver si hay fit real para [Empresa]?

Saludos,
Yoel A. Hernandez
```

Dia 3:

```text
Hola [Nombre],

Te lo reenvio por si se te paso.

En operaciones con varias validaciones y terceros, el cuello de botella suele estar en aprobaciones, evidencia y conciliacion, no en la ejecucion fisica. La hipotesis es simple: menos revision manual y menos disputa documental.

Si tiene sentido, lo vemos en 10 minutos y te digo rapido si merece seguir o no.

Saludos,
Yoel
```

Dia 10:

```text
Hola [Nombre],

Cierro por aqui para no insistir de mas.

Si mas adelante quereis revisar opciones para trazabilidad verificable o pagos programados en [Empresa], encantado de retomarlo. Si prefieres, tambien puedo escribir a la persona correcta.

Saludos,
Yoel
```

### Motion B: fabricantes SDK

Dia 1:

```text
Hola [Nombre],

Queria compartir una hipotesis concreta para [Empresa]: convertir parte de su base instalada en una nueva capa de ingresos recurrentes mediante integracion SDK.

La propuesta no va de cambiar su producto, sino de anadir una capa operativa para monetizacion postventa, trazabilidad verificable y nuevos servicios durante la vida util del equipo.

Web: https://bez.digital/
Compra directa: https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806
Auditoria: https://polygon.blockscout.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8?tab=contract
LinkedIn: https://www.linkedin.com/company/80822195/admin/dashboard/

¿Tienes 10 minutos esta semana para ver como seria una integracion minima?

Saludos,
Yoel A. Hernandez
```

Dia 4:

```text
Hola [Nombre],

Te sigo por aqui porque en fabricantes con equipos conectados suele haber una oportunidad desaprovechada: monetizar la postventa sin reescribir el producto ni reemplazar sistemas actuales.

Si te encaja, te explico en 10 minutos el modelo operativo minimo, recursos implicados y que revenue share podria abrir.

Saludos,
Yoel
```

Dia 12:

```text
Hola [Nombre],

Cierro el hilo para no saturarte.

Si mas adelante quereis explorar una prueba acotada sobre la base instalada de [Empresa], puedo preparar un piloto muy concreto y con bajo esfuerzo inicial.

Saludos,
Yoel
```

### Motion C: certificacion / partners

Dia 1:

```text
Hola [Nombre],

Creo que puede haber encaje entre [Empresa] y BeZhas en trazabilidad, validacion operativa y nuevos servicios verificables para clientes industriales.

La idea no es una colaboracion generica, sino explorar si vuestra capacidad de certificacion o validacion puede ampliarse con una capa digital de integracion y registro operativo.

Web: https://bez.digital/
Compra directa: https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806
Auditoria: https://polygon.blockscout.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8?tab=contract
LinkedIn: https://www.linkedin.com/company/80822195/admin/dashboard/

¿Te encaja una conversacion de 10 minutos para ver si hay sinergia comercial o tecnica?

Saludos,
Yoel A. Hernandez
```

Dia 5:

```text
Hola [Nombre],

Te escribo de nuevo porque creo que hay un encaje comercial claro si [Empresa] ya trabaja con validacion, auditoria o compliance para clientes industriales.

La oportunidad seria anadir evidencia verificable y nuevos servicios sin obligar al cliente final a cambiar su operativa base.

Si tiene sentido, lo vemos en 10 minutos.

Saludos,
Yoel
```

Dia 14:

```text
Hola [Nombre],

Cierro por aqui y dejamos la puerta abierta.

Si mas adelante quereis revisar un partnership tecnico-comercial en trazabilidad o validacion operativa, lo retomamos con gusto.

Saludos,
Yoel
```

## LinkedIn compliant

- Ejecutar `npm run linkedin:prospecting` y `npm run linkedin:messages` al inicio de cada corrida comercial.
- Leer el ultimo JSON de `logs/linkedin`.
- Sin token o sin permisos: solo tareas manuales y borradores.
- No scraping.
- No automatizacion de navegador.
- No DMs masivos.
- Aprobacion humana para C-level, inversion, M&A, primer contacto sensible y regulados.

## Reglas de stop

- respuesta
- rebote
- baja
- redireccion clara a otro contacto
- cuenta congelada por falta de fit

## Secuencia de cierre

1. Discovery call de 10 minutos
2. Resumen interno: dolor, stakeholders, urgencia, fit
3. Mini propuesta de 1 pagina
4. Piloto o fase 1 con alcance acotado
5. Revision legal/tecnica
6. Cierre
7. Kickoff

## Resumen diario esperado

```text
Fecha:
Motion:
Nuevos leads validos:
Correos enviados:
Rebotes:
Respuestas:
Reuniones propuestas:
Reuniones agendadas:
Oportunidades activas:
Bloqueos:
Siguiente foco:
```
