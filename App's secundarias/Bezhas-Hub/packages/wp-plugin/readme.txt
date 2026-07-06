=== BeZhas Hub — Embedded Gateway ===
Contributors: bezhas
Tags: woocommerce, payments, blockchain, crypto, gateway, subscriptions
Requires at least: 5.8
Tested up to: 6.5
Stable tag: 2.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Trae TODO el ecosistema BeZhas dentro de tu plataforma: suscríbete a los planes, activa las SubApps y cobra con BeZhas-Pay sin salir de tu wp-admin.

== Description ==

BeZhas Hub convierte tu WordPress en una puerta al ecosistema B2B de BeZhas. Una consola embebida en `wp-admin` te permite:

* **Conectar tu cuenta** con tu API Key (BeZhas_ID).
* **Suscribirte a los 4 planes** (Starter, Creator Pro, Business, Enterprise VIP) pagando en $BEZ con −20% de descuento, sin salir de tu panel.
* **Activar las SubApps** del ecosistema (CargoLink, Energy/VPP, Capital, Wallet, Vision, Gas, Pay) como servicios remotos — activar una SubApp amplía el scope de tu API Key.
* **Cobrar con BeZhas-Pay** en cualquier página mediante shortcode `[bezhas_pay]`, un bloque Gutenberg, o el gateway WooCommerce.

Toda la operación pasa por la API de BeZhas (`https://api.bez.digital`); tu API Key nunca viaja al navegador — el plugin firma las peticiones en el servidor a través de un puente REST local (`/wp-json/bezhas/v1/*`).

**Cómo funciona:**

1. Instala el plugin y abre "BeZhas Hub" en el menú de administración.
2. Pega tu API Key de la Developer Console y elige red (Polygon recomendado).
3. Suscríbete a un plan y activa las SubApps que necesites.
4. Inserta `[bezhas_pay amount="49.90" currency="EUR"]` o el bloque "BeZhas Pay" donde quieras cobrar.
5. En tiendas WooCommerce, además, "Pagar con BEZ-Coin" aparece en el checkout.

== Third Party Services ==

Este plugin se conecta a la **BeZhas API** (`https://api.bez.digital`) para: cargar planes y SubApps disponibles, validar tu cuenta, contratar suscripciones, activar SubApps y crear cobros. Los datos enviados son los necesarios para cada operación (API Key, plan elegido, importe, moneda, red, nombre de la tienda).

* Service homepage: [https://bez.digital](https://bez.digital)
* Terms of Service: [https://bez.digital/terms](https://bez.digital/terms)
* Privacy Policy: [https://bez.digital/privacy](https://bez.digital/privacy)

== Installation ==

1. Sube el ZIP en WordPress → Plugins → Añadir nuevo → Subir plugin.
2. Actívalo.
3. Ve a "BeZhas Hub" en el menú lateral y conecta tu API Key de [bez.digital/developer-console](https://bez.digital/developer-console).

== Frequently Asked Questions ==

= ¿Necesito WooCommerce? =

No. La consola, las suscripciones, las SubApps y BeZhas-Pay (shortcode/bloque) funcionan sin WooCommerce. El gateway de checkout es un módulo opcional que solo se activa si WooCommerce está presente.

= ¿Dónde consigo la API Key? =

En la Developer Console del Hub: [bez.digital/developer-console](https://bez.digital/developer-console).

= ¿Mi API Key es segura? =

Sí. Se guarda en la base de datos de WordPress y solo se usa desde el servidor (puente REST). Nunca se expone al navegador.

== Changelog ==

= 2.0.0 =
* Consola del Hub embebida en wp-admin (planes + SubApps + pago)
* Suscripción a los 4 planes con pago en $BEZ (−20%) desde el panel
* Activación de SubApps vía scope de API Key
* BeZhas-Pay universal: shortcode [bezhas_pay] + bloque Gutenberg
* Puente REST /wp-json/bezhas/v1/* (la API Key no viaja al cliente)
* Estado de conexión REAL (ping al Hub)
* Gateway WooCommerce convertido en módulo opcional

= 1.0.0 =
* Initial release — WooCommerce payment gateway

== Upgrade Notice ==

= 2.0.0 =
De gateway de pago a puerta completa del ecosistema BeZhas dentro de tu plataforma.
