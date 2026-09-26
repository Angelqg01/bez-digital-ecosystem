# Memo — Estructura de exención MiCA para la ronda BEZ-Coin

> Versión: Septiembre 2026 | Autor: Claude (borrador de trabajo para Yoel, BeZhas founder)
> **Estado: borrador para revisión legal — no es dictamen jurídico.** Antes de anunciar o abrir
> cualquier tramo de la ronda, un abogado especializado en MiCA debe confirmar por escrito los
> puntos marcados como ⚠️ en la sección 6.

---

## 1. Objeto

Estructurar la venta de BEZ-Coin descrita en `BEZHAS_FUNDING_EXPANSION_PLAN.md` (Fase 2) y en el
plan de compradores/plataformas de esta sesión, de forma que **ningún tramo requiera un white
paper autorizado por la CNMV**, apoyándose en las exenciones del Art. 4(2) del Reglamento MiCA
(UE 2023/1114).

España exige licencia MiCA plena desde el **1 de julio de 2026** — ya estamos dentro de ese
régimen al redactar este memo (septiembre 2026).

---

## 2. Resumen ejecutivo

La ronda se divide en **dos tramos**, cada uno amparado por una exención distinta:

| Tramo | Comprador | Exención aplicable | Softcap/Hardcap propuesto |
|---|---|---|---|
| **A — Privado** | Business angels, fondos semilla, clientes-operador B2B | Art. 4(2)(a) — inversores cualificados (MiFID II) | Sin tope de monto por esta vía, pero cuenta para el cómputo agregado del Tramo B |
| **B — Público acotado** | Comunidad RWA/DePIN + retail hispanohablante, vía launchpad | Art. 4(2)(c) — umbral de 1.000.000 € en 12 meses en la UE | Softcap $50.000 / Hardcap $300.000 (≈ dentro del umbral con margen) |

**Regla de oro que gobierna todo el memo:** el Tramo B no puede pasar de 1.000.000 € recaudados
**en la UE** en una ventana móvil de **12 meses**, y ese cómputo es **agregado**: suma *todas* las
ofertas de crypto-assets de BeZhas al público en ese periodo, no solo el IDO. El Tramo A, si se
hace correctamente solo con inversores cualificados, no consume ese cupo.

---

## 3. Marco legal aplicable

- **Reglamento (UE) 2023/1114 (MiCA)**, Título II — Crypto-assets distintos de ART/EMT (BEZ-Coin
  encaja aquí: utility token, no stablecoin ni token referenciado a activos).
- **Art. 4(2)** — exenciones de la obligación de publicar y notificar un white paper a la
  autoridad competente antes de una oferta al público.
- **Transposición española** — CNMV como autoridad competente para la supervisión de
  crypto-assets no clasificados como ART/EMT; régimen de aplicación plena desde julio 2026.
- **Art. 7 MiCA** — obligación de que *todas* las comunicaciones comerciales sean justas, claras
  y no engañosas, **aplica siempre, exista o no exención de white paper**. Esto no desaparece
  nunca, ni siquiera en el Tramo A.

---

## 4. Las tres exenciones del Art. 4(2) y cuál usa cada tramo

| # | Exención | Condición | Tramo que la usa |
|---|---|---|---|
| 1 | Inversores cualificados | Oferta dirigida exclusivamente a personas que califican como cliente profesional bajo MiFID II (entidades de crédito, empresas de inversión, grandes empresas que cumplan 2 de 3 umbrales de tamaño, profesionales electivos) | **Tramo A** |
| 2 | Menos de 150 personas | Oferta a menos de 150 personas físicas o jurídicas por Estado miembro, actuando por cuenta propia | Disponible como respaldo del Tramo A si algún comprador no certifica como cualificado |
| 3 | Umbral de 1.000.000 € / 12 meses | Contraprestación total de la oferta en la UE no supera 1M€ en una ventana de 12 meses desde el inicio de la oferta | **Tramo B** |

**Nota importante:** el Tramo A (inversores cualificados) exime del white paper **sin límite de
monto**. Por eso el pitch deck y el data room del Tramo A deben incluir una **certificación de
inversor cualificado** firmada antes de recibir cualquier fondo — es la pieza que sostiene toda
la exención de ese tramo.

---

## 5. Estructura propuesta, paso a paso

1. **Cerrar primero el Tramo A** (ronda privada B2B + angels, ya en marcha vía Lanzadera/Wayra/
   ENISA). Cada inversor firma la certificación de cualificado *antes* de transferir fondos.
   Ningún euro de este tramo cuenta contra el cupo del Tramo B si la certificación está en regla.
2. **Definir con el abogado si el Tramo B se lanza como oferta directa (DEX + comunidad propia) o
   a través de un launchpad ya registrado como CASP** (DAO Maker, Polkastarter, Seedify u otro).
   Si el launchpad es CASP, su KYC/AML cubre parte de la obligación; si no lo es, BeZhas necesita
   su propio proceso de KYC para el Tramo B.
3. **Fijar el hardcap del Tramo B con margen bajo 1.000.000 €** (el $300.000 ya definido deja
   colchón amplio) y contar cualquier otra oferta pública de BEZ-Coin que ocurra en los mismos
   12 meses contra ese mismo cupo — incluida liquidez inicial en DEX si se estructura como venta
   al público en vez de aporte de capital propio.
4. **Llevar un registro vivo del cómputo agregado** (hoja de cálculo con fecha, monto en €,
   comprador, tramo) desde el primer euro del Tramo B — es lo primero que pedirá un regulador o
   un auditor si se cuestiona la exención.
5. **Redactar un litepaper** (no el white paper formal de CNMV) para el Tramo B: sirve para
   CoinGecko/CoinMarketCap y para las comunicaciones del launchpad, y debe cumplir igualmente el
   Art. 7 (justo, claro, no engañoso) aunque no requiera autorización previa.

---

## 6. ⚠️ Puntos que el abogado MiCA debe confirmar antes de abrir cualquier tramo

1. ⚠️ Si la **liquidez inicial en los pools DEX** (QuickSwap/PancakeSwap) cuenta como "oferta al
   público" a efectos del cómputo de 1M€, o si al ser aporte propio de BeZhas queda fuera.
2. ⚠️ Si el cómputo agregado de 12 meses debe incluir ofertas hechas **antes** de julio de 2026
   (régimen transitorio) o solo desde la aplicación plena.
3. ⚠️ Si el launchpad elegido ya está efectivamente registrado como CASP en la fecha de
   lanzamiento — esto puede cambiar entre la redacción de este memo y el lanzamiento real.
4. ⚠️ Si algún comprador del Tramo A que **no** certifique como inversor cualificado debe
   reclasificarse bajo la exención de "menos de 150 personas" y qué implica eso para el cómputo
   del Tramo B (ver exención #2, tabla de la sección 4).
5. ⚠️ Redacción exacta del texto de certificación de inversor cualificado, y si BeZhas necesita
   verificarla con algo más que una declaración firmada (ej. prueba documental de patrimonio).

---

## 7. Checklist previo al lanzamiento

- [ ] Confirmación escrita del abogado MiCA sobre los 5 puntos de la sección 6
- [ ] Certificación de inversor cualificado lista y validada legalmente (Tramo A)
- [ ] Hoja de cómputo agregado de 12 meses creada y en uso desde el primer euro recaudado
- [ ] Litepaper redactado y revisado contra Art. 7 (justo/claro/no engañoso)
- [ ] Confirmación de si el launchpad elegido opera como CASP registrado
- [ ] Hardcap del Tramo B fijado con margen bajo el umbral de 1.000.000 €

---

## 8. Fuentes consultadas

- [MiCA — Artículo 4, exenciones del white paper](https://www.mica.wtf/mica/title-ii-crypto-assets-other-than-asset-referenced-tokens-or-e-money-tokens-art.-4-15/article-4)
- [Licencia CASP en España bajo MiCA — Gofaizen & Sherle](https://gofaizen-sherle.com/casp-license-in-spain)
- [Regulación cripto en España 2026 — Global Advisory Experts](https://globaladvisoryexperts.com/how-is-crypto-regulated-in-spain/)

---

*Memo generado: Septiembre 2026 — complementa `BEZHAS_FUNDING_EXPANSION_PLAN.md` y el plan de
compradores/plataformas de esta sesión.*
