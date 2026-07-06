<?php
/**
 * BeZhas WooCommerce Payment Gateway
 *
 * @package BeZhas_Hub
 * @license GPLv2 or later
 */

defined('ABSPATH') || exit;

class WC_BeZhas_Gateway extends WC_Payment_Gateway {

    public function __construct() {
        $this->id                 = 'bezhas';
        $this->icon               = BEZHAS_HUB_PLUGIN_URL . 'assets/bez-logo.svg';
        $this->has_fields         = false;
        $this->method_title       = 'BeZhas Hub (BEZ-Coin)';
        $this->method_description = 'Acepta pagos con BEZ-Coin, USDC y tokens ERC-20 via BeZhas Network. Liquidacion SEPA automatica.';

        $this->init_form_fields();
        $this->init_settings();

        $this->title          = $this->get_option('title');
        $this->description    = $this->get_option('description');
        // API-Key: usa la del gateway o, si está vacía, la conexión central del plugin.
        $this->api_key        = $this->get_option('api_key')
            ?: (class_exists('BeZhas_Client') ? BeZhas_Client::api_key() : '');
        $this->network        = $this->get_option('network', 'polygon');
        $this->webhook_secret = $this->get_option('webhook_secret', get_option('bezhas_hub_webhook_secret', ''));

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        add_action('woocommerce_api_bezhas_webhook', [$this, 'handle_webhook']);
    }

    public function init_form_fields() {
        $this->form_fields = [
            'enabled' => [
                'title'   => __('Activar/Desactivar', 'bezhas-hub'),
                'type'    => 'checkbox',
                'label'   => __('Activar pagos con BeZhas', 'bezhas-hub'),
                'default' => 'no',
            ],
            'title' => [
                'title'       => __('Titulo', 'bezhas-hub'),
                'type'        => 'text',
                'default'     => 'Pagar con BEZ-Coin',
                'description' => __('Lo que ve el cliente en checkout.', 'bezhas-hub'),
            ],
            'description' => [
                'title'   => __('Descripcion', 'bezhas-hub'),
                'type'    => 'textarea',
                'default' => 'Paga con BEZ-Coin o USDC. Liquidacion instantanea.',
            ],
            'api_key' => [
                'title'       => __('API Key', 'bezhas-hub'),
                'type'        => 'password',
                'description' => sprintf(
                    __('Tu API Key de %s.', 'bezhas-hub'),
                    '<a href="https://bez.digital/developer-console" target="_blank">Developer Console</a>'
                ),
            ],
            'network' => [
                'title'   => __('Red Blockchain', 'bezhas-hub'),
                'type'    => 'select',
                'options' => [
                    'polygon' => 'Polygon (recomendado)',
                    'bsc'     => 'BNB Chain',
                ],
                'default' => 'polygon',
            ],
            'webhook_secret' => [
                'title'       => __('Webhook Secret', 'bezhas-hub'),
                'type'        => 'text',
                'description' => __('Se genera en la activacion. Usado para verificar callbacks.', 'bezhas-hub'),
                'default'     => get_option('bezhas_hub_webhook_secret', ''),
            ],
        ];
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);

        if (!$order) {
            wc_add_notice(__('Pedido no encontrado.', 'bezhas-hub'), 'error');
            return ['result' => 'failure'];
        }

        $api_base = defined('BEZHAS_HUB_API_BASE') ? BEZHAS_HUB_API_BASE : 'https://api.bez.digital';

        $payload = [
            'orderId'   => $order_id,
            'amount'    => $order->get_total(),
            'amountUSD' => $order->get_total(), // compat: la Pay SubApp cotiza por importe
            'currency'  => $order->get_currency(),
            'payToken'  => 'BEZ',
            'network'   => sanitize_text_field($this->network),
            'callback'  => home_url('/wc-api/bezhas_webhook'),
            'metadata'  => ['store' => get_bloginfo('name'), 'source' => 'woocommerce'],
        ];

        // Endpoint canónico del Hub (Control Plane → Pay SubApp). El Hub autentica
        // máquina-a-máquina por X-API-Key; mantenemos Bearer por compatibilidad.
        $response = wp_remote_post($api_base . '/api/payment/create', [
            'headers' => [
                'X-API-Key'     => sanitize_text_field($this->api_key),
                'Authorization' => 'Bearer ' . sanitize_text_field($this->api_key),
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode($payload),
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            wc_add_notice(
                __('Error de conexion con BeZhas. Intente de nuevo.', 'bezhas-hub'),
                'error'
            );
            return ['result' => 'failure'];
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['paymentUrl']) && wp_http_validate_url($body['paymentUrl'])) {
            $order->update_status('pending', __('Esperando pago BeZhas', 'bezhas-hub'));
            return [
                'result'   => 'success',
                'redirect' => esc_url_raw($body['paymentUrl']),
            ];
        }

        wc_add_notice(__('No se pudo crear el pago. Intente de nuevo.', 'bezhas-hub'), 'error');
        return ['result' => 'failure'];
    }

    public function handle_webhook() {
        $raw = file_get_contents('php://input');
        $sig = isset($_SERVER['HTTP_X_BEZHAS_SIGNATURE'])
            ? sanitize_text_field(wp_unslash($_SERVER['HTTP_X_BEZHAS_SIGNATURE']))
            : '';

        if (empty($this->webhook_secret) || !hash_equals(hash_hmac('sha256', $raw, $this->webhook_secret), $sig)) {
            status_header(401);
            exit('Invalid signature');
        }

        $data = json_decode($raw, true);

        if (!is_array($data)) {
            status_header(400);
            exit('Invalid payload');
        }

        $order_id = isset($data['orderId']) ? absint($data['orderId']) : 0;
        $order    = wc_get_order($order_id);

        if (!$order) {
            status_header(404);
            exit('Order not found');
        }

        $status = isset($data['status']) ? sanitize_text_field($data['status']) : '';
        $tx_hash = isset($data['txHash']) ? sanitize_text_field($data['txHash']) : '';

        if ($status === 'confirmed') {
            $order->payment_complete($tx_hash);
            $order->add_order_note(
                sprintf(__('Pago confirmado via BeZhas. Tx: %s', 'bezhas-hub'), $tx_hash ?: 'N/A')
            );
        } elseif ($status === 'failed') {
            $order->update_status('failed', __('Pago fallido en BeZhas Network', 'bezhas-hub'));
        }

        status_header(200);
        exit('OK');
    }
}
