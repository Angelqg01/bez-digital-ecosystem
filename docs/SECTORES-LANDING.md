# Sectores de la landing — imágenes y estado

Registro de los sectores que BeZhas representa en la portada y del arte de cada
uno. Sirve para dos cosas: saber qué falta, y poder generarlo sin volver a
decidir el criterio.

---

## Los siete sectores

| # | Sector | Arte | Fichero |
|---|---|---|---|
| 1 | Navieras, cruceros y puertos | ✅ | `public/hero/sector-naval.webp` |
| 2 | Cadena de frío | ✅ | `public/hero/sector-cadena-frio.webp` |
| 3 | Supply Chain | ⬜ | — |
| 4 | Real Estate | ⬜ | — |
| 5 | Biotecnología | ⬜ | — |
| 6 | Instituciones y Gobiernos | ⬜ | — |
| 7 | Smart City | ⬜ | — |

Los dos primeros salen del núcleo del perfil de negocio: `naviera`/`puerto` es
el ICP primario (`config/business/bezhas.json`) y todos los mercados declarados
son ciudades portuarias; la cadena de frío aparece en cuatro propuestas de valor.

---

## Añadir un sector

Una entrada en `HERO_SECTORS` (`app/(landing)/page.tsx`). El CSS reparte solo
las fases del ciclo mediante `--n` / `--i`, así que no hay que tocar
`globals.css` — salvo actualizar `--n` en `.hero-plate-sector`.

```tsx
{ src: '/hero/sector-smart-city.webp', sector: 'Smart City' },
```

Cada placa: 16:9, WebP calidad 68, objetivo < 130 KB.

---

## Reglas que cumple toda placa del hero

Nacen de las `honestyRules` del perfil de negocio ("nunca inventes clientes,
partners, pilotos, validaciones ni resultados") y del sitio donde se ven.

1. **Sin personas, sin texto legible, sin rótulos, sin logotipos.** Una placa que
   parezca la instalación de un cliente es una afirmación implícita sobre
   operaciones que no son nuestras.
2. **Silueta y luz por encima del detalle.** El plano va a `translateZ(-220px)`,
   escala 1,42×, opacidad 40%, detrás de un velo al 82% y de una retícula. A esa
   profundidad solo lee la forma grande.
3. **Luz entrando por la derecha.** El velo del hero es casi opaco a la izquierda
   y deja pasar al 35% a la derecha.
4. **Registro casi negro.** Si la fuente sale luminosa, se baja antes de montarla
   (a la de cadena de frío se le aplicó `exposure -0.9`, `gamma 0.72`).
5. **Grano ~20.** Un degradado oscuro y liso produce bandas visibles en pantallas
   de 8 bits; el grano las rompe.

---

## Prompts listos (Higgsfield · 2 créditos cada uno)

Escritos en el registro oscuro del hero. Para la variante clara isométrica, ver
la nota del final.

**Supply Chain**
> Abstract industrial warehouse interior at night. Endless rows of tall racking
> reduced to dark silhouettes in receding perspective, thin teal light glancing
> from the right edge, heavy atmospheric haze, deep near-black shadows. No people,
> no text, no lettering, no logos, no boxes with markings. Minimal, geometric,
> cinematic.

**Real Estate**
> Abstract architectural facade at night. A grid of glazed building volumes
> reduced to flat dark geometry, thin teal light raking across from the right,
> deep near-black sky, atmospheric haze softening the edges, layered depth. No
> people, no text, no signage, no logos. Minimal, geometric, cinematic.

**Biotecnología**
> Abstract laboratory atmosphere. Rows of empty glass vessels and tubing as dark
> translucent silhouettes, cold teal light entering from the right, refractions
> through glass, deep near-black background, fine particulate in the air. No
> people, no text, no labels, no logos. Minimal, clinical, cinematic.

**Instituciones y Gobiernos**
> Abstract civic architecture at night. A colonnade of tall stone columns reduced
> to dark silhouettes in receding perspective, thin teal light entering from the
> right, deep near-black shadows, atmospheric haze. No people, no text, no
> inscriptions, no flags, no emblems, no logos. Minimal, monumental, cinematic.

**Smart City**
> Abstract city grid seen from above at night. Streets and blocks reduced to a
> dark geometric lattice, thin teal light traces along the arteries, deep
> near-black ground, atmospheric haze, layered depth. No people, no text, no
> signage, no logos, no vehicles. Minimal, geometric, cinematic.

---

## Origen del arte

Generación propia con Higgsfield (2 créditos por placa). **Descartado licenciar
de Adobe Stock** por decisión de producto: el arte de la portada se genera, no se
licencia.

---

## Nota sobre el estilo isométrico claro

Las referencias isométricas de fondo claro (menta/azul/crema, objetos con brillo
de render) **no funcionan como fondo del hero**: su detalle desaparece a esa
profundidad y su luminosidad pelea con el fondo casi negro.

Su sitio natural es una **banda clara a opacidad plena**, del registro de la
sección `bg-[#f5f7fb]` que ya existe en la landing ("SubApps BeZhas"). Ahí se ven
enteras, con etiqueta, y encajan con el argumento comercial: los sectores son lo
que se vende, no ambiente.
