# Carta de intención — Piloto BeZhas × NauticOps

> **BORRADOR (2026-11-05). No enviar sin revisión de un abogado.**
> Los campos `[entre corchetes]` están sin rellenar. NauticOps no publica razón
> social, CIF ni domicilio: se exigen antes de firmar (cláusula 9).
> Sin vinculación salvo las cláusulas 6, 7 y 8.

---

**En** [ciudad], a [fecha]

**ENTRE**

- **[Razón social de BeZhas]**, CIF [•], domicilio en [•], representada por [nombre y cargo] ("**BeZhas**").
- **[Razón social de NauticOps]**, CIF [•], domicilio en [•], representada por [nombre y cargo] ("**NauticOps**").

## 1. Objeto

Las partes manifiestan su intención de ejecutar un **piloto técnico y operativo**
para comprobar si la coordinación de escalas portuarias de NauticOps puede
integrarse con la cadena de custodia y la trazabilidad de **CargoLink**
(SubApp de BeZhas), con anclaje verificable de las confirmaciones de servicio.

## 2. Alcance del piloto

| Elemento | Propuesta |
|---|---|
| Puerto | [Algeciras / Huelva — a acordar] |
| Escalas | [3–5] escalas reales, con consentimiento de los agentes y servicios implicados |
| Duración | [4–6] semanas desde la fecha de inicio acordada |
| Entorno | Sandbox primero; producción solo por acuerdo escrito de ambas partes |
| Integración | Webhooks firmados (HMAC) NauticOps → CargoLink: ETA, atraque, servicios y confirmaciones |
| Anclaje | BeZhas registra el resumen criptográfico (hash) de cada confirmación en lote on-chain. **No se publican datos personales ni comerciales en cadena.** |
| Confirmación humana | Ningún cambio de custodia ni liquidación se ejecuta sin confirmación humana explícita |

Fuera del alcance: pagos en BEZ u otros activos, liquidación entre terceros y
cualquier funcionalidad que requiera autorización regulatoria (MiCA, servicios
de pago).

## 3. Contribuciones

**BeZhas:** entorno sandbox, credenciales con permisos mínimos, receptor de
webhooks, anclaje, soporte técnico razonable y un interlocutor designado.

**NauticOps:** acceso a su plataforma para las escalas piloto, documentación
técnica de su API o formato de intercambio, interlocutor técnico designado y
acceso, si procede, a usuarios de los actores participantes.

## 4. Métrica de éxito

Se medirá **un único resultado principal**: el tiempo que tarda un cambio de ETA
en reflejarse para todos los actores de la escala, comparado con el método
actual (llamadas y mensajería). Métricas secundarias: confirmaciones
registradas sin intervención manual e incidencias detectadas.
Línea base y método de medición se acuerdan por escrito antes de empezar.

## 5. Costes

Cada parte asume sus propios costes. **No hay pagos entre las partes durante el
piloto.** Cualquier licencia, reparto de ingresos o precio posterior se negociará
en un acuerdo definitivo, no determinado por esta carta.

## 6. Confidencialidad (vinculante)

Toda información técnica, comercial o de clientes intercambiada es confidencial,
se usará solo para el piloto y no se revelará a terceros. Vigencia: [2] años desde
la firma. Se exceptúa lo público o lo exigido por ley.

## 7. Protección de datos (vinculante)

Antes de intercambiar datos personales se firmará un **contrato de encargo de
tratamiento (DPA)** o un acuerdo entre corresponsables, según proceda, conforme
al RGPD. Hasta entonces solo se usarán datos sintéticos o sin datos personales.
NauticOps declarará el origen y la base jurídica de los datos portuarios que
aporte, incluida la licencia de reutilización de los datos de la Autoridad
Portuaria.

## 8. Propiedad intelectual y no exclusividad (vinculante)

Cada parte conserva la propiedad de su tecnología, marcas y datos. Lo que se
desarrolle conjuntamente para el conector se regulará en el acuerdo definitivo;
hasta entonces, cada parte conserva lo que aporta. **Esta carta no establece
exclusividad**: ambas partes pueden pilotar con terceros. Ninguna parte usará el
nombre o logotipo de la otra en comunicaciones sin permiso escrito.

## 9. Condiciones previas

El piloto solo empieza si, antes de [fecha]:

1. NauticOps acredita su **identidad societaria** (escritura, CIF, representante).
2. NauticOps entrega **documentación de su API** o formato de intercambio y un sandbox.
3. NauticOps acredita su **derecho a usar los datos portuarios** que ofrece.
4. Se firma el DPA de la cláusula 7.
5. Ambas partes aprueban por escrito el plan de piloto detallado (puerto, escalas, fechas, interlocutores).

## 10. Duración y terminación

Esta carta caduca a los [60] días sin acuerdo definitivo o antes si cualquiera
lo comunica por escrito con [15] días de preaviso. Al terminar, cada parte
borrará o devolverá la información confidencial, salvo los hash ya anclados,
que no contienen datos recuperables.

## 11. Naturaleza no vinculante

Salvo las cláusulas 6, 7 y 8, esta carta expresa una intención y **no obliga** a
celebrar un acuerdo definitivo ni a pagar nada. Ley aplicable: española.
Jurisdicción: [juzgados de Algeciras / a acordar].

**Firmas**

| BeZhas | NauticOps |
|---|---|
| Nombre: | Nombre: |
| Cargo: | Cargo: |
| Fecha: | Fecha: |

---

## Anexo — Preguntas a resolver antes de firmar

1. ¿Cuál es la razón social, CIF y estructura societaria? ¿Quién participa en el capital?
2. ¿Existe API real? ¿Hay documentación y sandbox, o la integración es manual o por CSV?
3. ¿Qué datos entran automáticamente (PCS, TOS, AIS, web de la Autoridad Portuaria) y cuáles se introducen a mano?
4. ¿Con qué licencia o convenio reutilizan y redistribuyen los datos de la Autoridad Portuaria?
5. ¿Qué clientes de pago o pilotos firmados tienen hoy? ¿Referencias de Marín, Alicante o Huelva?
6. ¿Qué metodología respalda el "hasta 3x" que publican?
7. ¿Qué certificaciones y medidas de seguridad tienen (ISO 27001, ENS, copias, control de acceso)?
8. ¿Cuál es su rol RGPD y a qué proveedores y países trasladan datos?
9. ¿Cómo se financian y cuánta caja tienen? ¿Qué papel real tienen La Lonja Tech, Incubazul–BlueCore y Santander X?
10. ¿Cuál es su modelo económico previsto para un acuerdo posterior (licencia, reparto, otro)?
