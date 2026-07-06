<?php
/**
 * BeZhas_Shortcode — pago BeZhas-Pay fuera de WooCommerce.
 *
 * Expone el checkout BEZ en cualquier página:
 *   - Shortcode:  [bezhas_pay amount="49.90" currency="EUR" label="Pagar"]
 *   - Bloque Gutenberg: "BeZhas Pay" (assets/block.js)
 *
 * El botón pide un intent al REST bridge (/wp-json/bezhas/v1/pay/intent) y
 * redirige a la página de pago hospedada del Hub.
 *
 * @package BeZhas_Hub
 * @license GPLv2 or later
 */

defined('ABSPATH') || exit;

class BeZhas_Shortcode {

    public function register() {
        add_shortcode('bezhas_pay', [$this, 'render']);
        add_action('init', [$this, 'register_block']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_front']);
    }

    public function enqueue_front() {
        wp_register_script('bezhas-pay-front', BEZHAS_HUB_PLUGIN_URL . 'assets/pay-front.js', [], BEZHAS_HUB_VERSION, true);
        wp_localize_script('bezhas-pay-front', 'BeZhasPay', [
            'restBase' => esc_url_raw(rest_url('bezhas/v1')),
            'nonce'    => wp_create_nonce('wp_rest'),
        ]);
        wp_register_style('bezhas-pay-front', BEZHAS_HUB_PLUGIN_URL . 'assets/console.css', [], BEZHAS_HUB_VERSION);
    }

    /**
     * Render del botón de pago. Nota: el intent real exige capability
     * manage_options (lo crea el comerciante/configuración), por lo que el
     * front público dispara el flujo vía el endpoint hospedado del Hub.
     */
    public function render($atts) {
        $atts = shortcode_atts([
            'amount'   => '0',
            'currency' => 'EUR',
            'label'    => __('Pagar con BeZhas-Pay', 'bezhas-hub'),
        ], $atts, 'bezhas_pay');

        wp_enqueue_script('bezhas-pay-front');
        wp_enqueue_style('bezhas-pay-front');

        $amount   = esc_attr($atts['amount']);
        $currency = esc_attr($atts['currency']);
        $label    = esc_html($atts['label']);

        return sprintf(
            '<button class="bezhas-pay-btn" data-amount="%s" data-currency="%s">%s</button>',
            $amount,
            $currency,
            $label
        );
    }

    public function register_block() {
        if (!function_exists('register_block_type')) {
            return;
        }
        wp_register_script(
            'bezhas-pay-block',
            BEZHAS_HUB_PLUGIN_URL . 'assets/block.js',
            ['wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components'],
            BEZHAS_HUB_VERSION,
            true
        );
        register_block_type('bezhas/pay', [
            'editor_script'   => 'bezhas-pay-block',
            'render_callback' => [$this, 'render_block'],
            'attributes'      => [
                'amount'   => ['type' => 'string', 'default' => '0'],
                'currency' => ['type' => 'string', 'default' => 'EUR'],
                'label'    => ['type' => 'string', 'default' => 'Pagar con BeZhas-Pay'],
            ],
        ]);
    }

    public function render_block($attrs) {
        return $this->render($attrs);
    }
}
