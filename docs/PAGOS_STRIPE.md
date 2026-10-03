# Pagos reales con Stripe (planes y compra de BEZ)

Un único servicio (`backend/services/billing-checkout.service.js`) atiende a la web, las apps nativas, el chat y el MCP.
**Pagar siempre ocurre en la página alojada por Stripe**: ni el chat, ni las apps, ni el MCP ven datos de tarjeta.

## Reglas de seguridad
- **Identidad solo de la sesión** (JWT de la web/app o token OAuth del MCP). Nunca del cuerpo de la petición.
- **Precio solo del servidor** (`config/tier.config.js`, EUR). El cliente envía `planId` y `cycle`, nada más.
- **Redirecciones solo de `FRONTEND_URL`**; la URL de pago devuelta debe ser `checkout.stripe.com` / `billing.stripe.com` (se valida en servidor, chat y MCP).
- **Activación solo por webhook firmado** (`/api/stripe/webhook`), idempotente; pago `paid`, sesión ligada al usuario (`client_reference_id` = `bz_user_id`).
- La compra de BEZ solo entrega con pago confirmado y en EUR, a la wallet vinculada de la cuenta (nunca a una enviada en la petición).
- Errores desconocidos no se devuelven al cliente (`error.message` no se filtra).

## API (`/api/checkout`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/plans` | pública | Catálogo con precios mensual/anual |
| POST | `/plan` | sesión / OAuth `billing.checkout` | `{ planId: creator\|business\|enterprise, cycle: monthly\|yearly }` → `{ url }` |
| POST | `/bez` | idem | `{ amountEur }` (10–5000 EUR, 2 decimales) → `{ url }` |
| POST | `/portal` | idem | Portal de facturación (tarjeta, facturas, cancelar) |
| GET | `/session/:id` | idem | Estado de **tu** sesión de pago |

Apps nativas: `POST` con `Authorization: Bearer <JWT>`, abrir `url` en el navegador del sistema / SFSafariViewController / Custom Tab y volver por el enlace profundo configurado; consultar `GET /session/:id` o el plan del usuario para confirmar.

## Chat
Acciones `subscribe_plans` (ventana de planes con «Suscribirme», mensual/anual) y `buy_bez` (importe en EUR). El chat solo redirige a una URL de Stripe validada.

## MCP
Scope OAuth `billing.checkout` (hay que pedirlo explícitamente; por defecto solo se piden los de lectura). Herramientas: `list_plans`, `create_plan_checkout`, `create_bez_checkout`. Reenvían el token de la persona al backend, que verifica firma ES256, audiencia y scope.

## Configuración
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`; opcionales `BEZ_PURCHASE_MIN_EUR`, `BEZ_PURCHASE_MAX_EUR`, `CHECKOUT_RATE_LIMIT`, `STRIPE_EXTRA_HOSTS`.
Eventos de webhook a activar: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated|deleted`, `invoice.payment_succeeded|failed`.
Migración: `backend/db/migrations/015_users_billing.sql`.
