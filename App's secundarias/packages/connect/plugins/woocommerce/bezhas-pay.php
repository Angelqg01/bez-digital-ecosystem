<?php
/**
 * Plugin Name: BeZhas Pay for WooCommerce
 * Description: Accept payments settled in BEZ-Coin without leaving your store. The
 *              customer checks out inside WooCommerce; BeZhas returns a Stripe
 *              checkout (card) or IBAN instructions (bank) and confirms via a
 *              signed webhook. This is the "extension" layer — it only talks to
 *              the BeZhas gateway over HTTPS (no SDK build step required in PHP).
 * Version:     0.1.0
 * Author:      BeZhas
 *
 * Settings (Admin > Settings > General is replaced by the gateway form below):
 *   - api_key        registered-app key -> sent as `x-api-key`
 *   - webhook_secret shared secret to verify status callbacks (HMAC-SHA256)
 *   - base_url       https://api.bez.digital (default)
 */

if (!defined('ABSPATH')) exit;

add_filter('woocommerce_payment_gateways', function ($gateways) {
    $gateways[] = 'WC_BeZhas_Gateway';
    return $gateways;
});

add_action('plugins_loaded', function () {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_BeZhas_Gateway extends WC_Payment_Gateway {
        public function __construct() {
            $this->id                 = 'bezhas_pay';
            $this->method_title       = 'BeZhas Pay';
            $this->method_description = 'Settle WooCommerce orders in BEZ-Coin via the BeZhas gateway.';
            $this->has_fields         = false;

            $this->init_form_fields();
            $this->init_settings();

            $this->title          = $this->get_option('title', 'Pay with BeZhas (card / bank)');
            $this->api_key        = $this->get_option('api_key');
            $this->webhook_secret = $this->get_option('webhook_secret');
            $this->base_url       = rtrim($this->get_option('base_url', 'https://api.bez.digital'), '/');

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        }

        public function init_form_fields() {
            $this->form_fields = [
                'enabled'        => ['title' => 'Enable', 'type' => 'checkbox', 'label' => 'Enable BeZhas Pay', 'default' => 'no'],
                'title'          => ['title' => 'Title', 'type' => 'text', 'default' => 'Pay with BeZhas (card / bank)'],
                'api_key'        => ['title' => 'API Key', 'type' => 'password', 'description' => 'Registered-app key (x-api-key).'],
                'webhook_secret' => ['title' => 'Webhook Secret', 'type' => 'password', 'description' => 'Shared secret to verify status callbacks.'],
                'base_url'       => ['title' => 'API Base URL', 'type' => 'text', 'default' => 'https://api.bez.digital'],
            ];
        }

        /** Called when the customer places the order. Mirrors @bezhas/connect pay.buy(). */
        public function process_payment($order_id) {
            $order = wc_get_order($order_id);

            $response = wp_remote_post($this->base_url . '/api/gateway/v1/payments/buy', [
                'timeout' => 20,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'x-api-key'    => $this->api_key,
                ],
                'body' => wp_json_encode([
                    'amountUSD'      => (float) $order->get_total(),
                    'paymentMethod'  => 'card',
                    'email'          => $order->get_billing_email(),
                    // Carry the WooCommerce order id so the webhook can match it back.
                    'stripeUseCase'  => 'token_purchase',
                ]),
            ]);

            if (is_wp_error($response)) {
                wc_add_notice('BeZhas Pay unavailable: ' . $response->get_error_message(), 'error');
                return ['result' => 'failure'];
            }

            $data = json_decode(wp_remote_retrieve_body($response), true);
            if (empty($data['success']) || empty($data['checkoutUrl'])) {
                wc_add_notice('BeZhas Pay error: ' . ($data['error'] ?? 'unknown'), 'error');
                return ['result' => 'failure'];
            }

            $order->update_status('pending', 'Awaiting BeZhas settlement.');
            $order->update_meta_data('_bezhas_payment_id', $data['paymentId'] ?? '');
            $order->save();

            // Keep the customer in-flow: redirect to the embedded BeZhas checkout.
            return ['result' => 'success', 'redirect' => $data['checkoutUrl']];
        }
    }
});

/**
 * Signed status webhook: POST {site}/?bezhas-webhook=1
 *
 * Verifies HMAC-SHA256(rawBody, secret) the SAME way the backend signs it in
 * api/services/cargoLinkLifecycle.js::fanoutWebhooks — header is
 *   X-BeZhas-Signature: sha256=<hex>
 * so we strip the `sha256=` prefix before comparing (hash_equals, timing-safe).
 *
 * NOTE ON PAY: today the authoritative BEZ settlement happens on the BeZhas side
 * (Stripe webhook -> mint, see api/routes/webhooks.js). There is not yet an
 * outbound Pay->merchant callback, so this handler matches a forward-compatible
 * shape and also accepts `paymentId`. Until that fan-out ships, rely on Stripe's
 * own success return URL for the buyer, and reconcile via pay.history().
 */
add_action('init', function () {
    if (!isset($_GET['bezhas-webhook'])) return;

    $raw      = file_get_contents('php://input');
    $header   = $_SERVER['HTTP_X_BEZHAS_SIGNATURE'] ?? '';
    $sig      = str_contains($header, '=') ? substr($header, strpos($header, '=') + 1) : $header;
    $settings = get_option('woocommerce_bezhas_pay_settings', []);
    $secret   = $settings['webhook_secret'] ?? '';

    $expected = hash_hmac('sha256', $raw, $secret);
    if (!$secret || !hash_equals($expected, strtolower($sig))) {
        status_header(401);
        echo wp_json_encode(['error' => 'invalid signature']);
        exit;
    }

    $payload   = json_decode($raw, true);
    // CargoLink fan-out uses bUid; a future Pay fan-out would use paymentId.
    $ref       = $payload['paymentId'] ?? $payload['bUid'] ?? null;
    $status    = $payload['status'] ?? '';
    $tx_hash   = $payload['txHash'] ?? null;

    if ($ref && in_array($status, ['confirmed', 'completed'], true)) {
        $orders = wc_get_orders(['meta_key' => '_bezhas_payment_id', 'meta_value' => $ref, 'limit' => 1]);
        if (!empty($orders)) {
            $order = $orders[0];
            $order->payment_complete($tx_hash ?: '');
            $order->add_order_note('BeZhas settlement confirmed. tx: ' . ($tx_hash ?: 'n/a'));
        }
    }

    status_header(200);
    echo wp_json_encode(['received' => true]);
    exit;
});
