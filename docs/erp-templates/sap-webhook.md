# SAP S/4HANA — BeZhas Webhook Integration

> Template de integración para notarizar transacciones SAP en la blockchain BeZhas L2.

## Resumen

Este documento describe cómo configurar SAP S/4HANA para enviar webhooks al Edge Node de BeZhas cada vez que ocurre una transacción relevante (orden de compra, factura, pago, movimiento de inventario).

## Arquitectura

```
SAP S/4HANA  →  ABAP HTTP Client  →  BeZhas Edge Node  →  Blockchain L2
(evento)        (webhook POST)        (notarización)       (registro inmutable)
```

## Requisitos

- SAP S/4HANA 2020+ o SAP ECC 6.0 con SAP_BASIS ≥ 752
- RFC destination configurada para HTTPS
- Certificado SSL del Edge Node importado en STRUST
- Credenciales BeZhas: `webhookSecret` del onboarding

## Paso 1: Crear RFC Destination

1. Ir a transacción **SM59**
2. Crear destino tipo **G** (HTTP Connection to External Server)
3. Configurar:
   - **Host**: `<tu-edge-node-ip>` (ej: `edge.miempresa.com`)
   - **Port**: `4200` (puerto por defecto del Edge Node)
   - **Path Prefix**: `/api/webhook/ingest`
   - **SSL**: Activo (certificado en STRUST)

## Paso 2: Clase ABAP para Webhook

```abap
CLASS zcl_bezhas_webhook DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CLASS-METHODS send_event
      IMPORTING
        iv_event_type   TYPE string
        iv_document_id  TYPE string
        iv_amount       TYPE p DECIMALS 2 OPTIONAL
        iv_currency     TYPE waers OPTIONAL
        iv_sector       TYPE string OPTIONAL
        iv_metadata     TYPE string OPTIONAL
      RETURNING
        VALUE(rv_tx_hash) TYPE string
      RAISING
        cx_http_comm_error.

  PRIVATE SECTION.
    CLASS-DATA: gv_webhook_secret TYPE string VALUE '<TU_WEBHOOK_SECRET>'.
    CLASS-DATA: gv_rfc_dest       TYPE rfcdest VALUE 'ZBEZHAS_EDGE'.
ENDCLASS.

CLASS zcl_bezhas_webhook IMPLEMENTATION.

  METHOD send_event.
    DATA: lo_http_client TYPE REF TO if_http_client,
          lv_payload     TYPE string,
          lv_timestamp   TYPE string,
          lv_signature   TYPE string,
          lv_response    TYPE string.

    " Construir timestamp ISO 8601
    lv_timestamp = cl_abap_tstmp=>utclong2string(
      utclong_current( ) ).

    " Payload JSON
    lv_payload = |\{| &&
      |"event":"{ iv_event_type }",| &&
      |"documentId":"{ iv_document_id }",| &&
      |"amount":{ COND #( WHEN iv_amount IS NOT INITIAL THEN iv_amount ELSE '0' ) },| &&
      |"currency":"{ COND #( WHEN iv_currency IS NOT INITIAL THEN iv_currency ELSE 'USD' ) }",| &&
      |"sector":"{ COND #( WHEN iv_sector IS NOT INITIAL THEN iv_sector ELSE 'general' ) }",| &&
      |"source":"sap-s4hana",| &&
      |"timestamp":"{ lv_timestamp }",| &&
      |"metadata":{ COND #( WHEN iv_metadata IS NOT INITIAL THEN iv_metadata ELSE '{}' ) }| &&
      |\}|.

    " HMAC-SHA256 signature
    DATA(lo_hmac) = cl_abap_hmac=>get_instance(
      if_algorithm = 'SHA256'
      if_key       = cl_abap_hmac=>string_to_xstring( gv_webhook_secret ) ).
    lo_hmac->update( cl_abap_hmac=>string_to_xstring( lv_payload ) ).
    lv_signature = lo_hmac->final_hex( ).

    " Enviar HTTP POST
    cl_http_client=>create_by_destination(
      EXPORTING destination = gv_rfc_dest
      IMPORTING client = lo_http_client ).

    lo_http_client->request->set_method( 'POST' ).
    lo_http_client->request->set_header_field(
      name = 'Content-Type' value = 'application/json' ).
    lo_http_client->request->set_header_field(
      name = 'X-BeZhas-Signature' value = lv_signature ).
    lo_http_client->request->set_header_field(
      name = 'X-BeZhas-Timestamp' value = lv_timestamp ).
    lo_http_client->request->set_cdata( lv_payload ).

    lo_http_client->send( ).
    lo_http_client->receive( ).

    " Leer respuesta
    lv_response = lo_http_client->response->get_cdata( ).
    lo_http_client->close( ).

    " Extraer txHash de la respuesta
    " Respuesta esperada: {"success":true,"txHash":"0xabc...","blockNumber":12345}
    FIND REGEX '"txHash":"(0x[a-fA-F0-9]+)"' IN lv_response
      SUBMATCHES rv_tx_hash.

  ENDMETHOD.

ENDCLASS.
```

## Paso 3: Business Add-In (BAdI) para eventos automáticos

### Ejemplo: Notarizar creación de Orden de Compra

```abap
METHOD if_ex_me_process_po_cust~process_account.
  " Se ejecuta al grabar PO
  DATA: lv_po_number TYPE ebeln,
        lv_amount    TYPE bapicurr-bapicurr,
        lv_tx_hash   TYPE string.

  lv_po_number = im_ebeln.
  lv_amount    = im_ekpo-netwr.

  TRY.
    lv_tx_hash = zcl_bezhas_webhook=>send_event(
      iv_event_type  = 'purchase_order_created'
      iv_document_id = lv_po_number
      iv_amount      = lv_amount
      iv_currency    = im_ekpo-waers
      iv_sector      = 'supply_chain'
      iv_metadata    = |{"vendor":"{ im_ekko-lifnr }","plant":"{ im_ekpo-werks }"}|
    ).

    " Guardar txHash en campo custom Z
    UPDATE ekko SET zbezhas_tx = lv_tx_hash WHERE ebeln = lv_po_number.
  CATCH cx_http_comm_error INTO DATA(lx_error).
    " Log error pero no bloquear la PO
    MESSAGE lx_error->get_text( ) TYPE 'W'.
  ENDTRY.
ENDMETHOD.
```

### Eventos SAP recomendados

| Evento SAP | Event Type (webhook) | Sector sugerido |
|---|---|---|
| Crear Orden de Compra | `purchase_order_created` | `supply_chain` |
| Entrada de Mercancía (MIGO) | `goods_receipt` | `Logística` |
| Factura de Proveedor (MIRO) | `vendor_invoice` | `Finanzas` |
| Pago (F110) | `payment_executed` | `Finanzas` |
| Movimiento de Stock (MB1A/MB1B) | `stock_movement` | `Manufactura` |
| Entrega de Salida (VL01N) | `outbound_delivery` | `Logística` |
| Factura de Cliente (VF01) | `customer_invoice` | `Retail` |

## Paso 4: Verificar en Control Center

1. Ir a **BeZhas Control Center** → Dashboard → Validators
2. En la sección de webhooks, verificar que aparece el evento reciente
3. El `txHash` devuelto se puede verificar en el explorador: `https://explorer.bez.digital/tx/<txHash>`

## Payload de Webhook (Referencia)

```json
{
  "event": "purchase_order_created",
  "documentId": "4500001234",
  "amount": 15000.00,
  "currency": "EUR",
  "sector": "supply_chain",
  "source": "sap-s4hana",
  "timestamp": "2025-01-15T14:30:00Z",
  "metadata": {
    "vendor": "0001000050",
    "plant": "1000"
  }
}
```

### Headers requeridos

| Header | Descripción |
|---|---|
| `Content-Type` | `application/json` |
| `X-BeZhas-Signature` | HMAC-SHA256 del body con `webhookSecret` |
| `X-BeZhas-Timestamp` | ISO 8601 UTC timestamp del envío |

### Respuesta del Edge Node

```json
{
  "success": true,
  "txHash": "0x7a8b9c...",
  "blockNumber": 12345,
  "gasUsed": "21000"
}
```

## Seguridad

- **HMAC-SHA256**: Toda solicitud debe firmarse con el `webhookSecret` configurado durante el onboarding
- **TLS/SSL**: Solo conexiones HTTPS al Edge Node
- **IP Whitelist**: Configurar firewall del Edge Node para aceptar solo IPs del servidor SAP
- **Retry**: Si el Edge Node responde con error 5xx, reintentar con backoff exponencial (3 intentos max)

## Troubleshooting

| Problema | Solución |
|---|---|
| Error SSL en SM59 | Importar certificado root CA en STRUST → SSL Client |
| HTTP 401 Unauthorized | Verificar `X-BeZhas-Signature` y `webhookSecret` |
| HTTP 503 Service Unavailable | Edge Node puede estar sincronizando; reintentar |
| Timeout | Aumentar timeout en RFC destination (recomendado: 30s) |
