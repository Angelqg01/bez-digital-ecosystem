<?php
/**
 * Plugin Name: BeZhas Hub — Embedded Gateway
 * Plugin URI: https://bez.digital/plugin/wp
 * Description: Trae TODO el ecosistema BeZhas dentro de tu plataforma: suscríbete a los planes, activa las SubApps (CargoLink, Energy, Pay, Capital...) y cobra con BeZhas-Pay sin salir de tu wp-admin. Gateway WooCommerce incluido.
 * Version: 2.0.0
 * Author: BeZhas
 * Author URI: https://bez.digital
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: bezhas-hub
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.5
 */

defined('ABSPATH') || exit;

define('BEZHAS_HUB_VERSION', '2.0.0');
define('BEZHAS_HUB_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BEZHAS_HUB_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BEZHAS_HUB_API_BASE', 'https://api.bez.digital');

require_once BEZHAS_HUB_PLUGIN_DIR . 'includes/class-bezhas-client.php';
require_once BEZHAS_HUB_PLUGIN_DIR . 'includes/class-bezhas-rest.php';
require_once BEZHAS_HUB_PLUGIN_DIR . 'includes/class-bezhas-shortcode.php';

/**
 * Arranque del plugin: REST bridge, shortcode/bloque y gateway WooCommerce
 * (este último solo si WooCommerce está activo — es un módulo opcional).
 */
add_action('plugins_loaded', 'bezhas_hub_init');
function bezhas_hub_init() {
    // i18n: carga traducciones desde /languages.
    load_plugin_textdomain('bezhas-hub', false, dirname(plugin_basename(__FILE__)) . '/languages');

    // REST bridge: /wp-json/bezhas/v1/* (firma con la API-Key del tenant).
    ( new BeZhas_REST() )->register();

    // Pago universal fuera de WooCommerce: shortcode [bezhas_pay] + bloque.
    ( new BeZhas_Shortcode() )->register();

    // Gateway WooCommerce = módulo opcional.
    if (class_exists('WC_Payment_Gateway')) {
        require_once BEZHAS_HUB_PLUGIN_DIR . 'includes/class-bezhas-gateway.php';
        add_filter('woocommerce_payment_gateways', function ($gateways) {
            $gateways[] = 'WC_BeZhas_Gateway';
            return $gateways;
        });
    }
}

/**
 * Menú de administración: la consola embebida es la página principal.
 */
add_action('admin_menu', function () {
    add_menu_page(
        'BeZhas Hub',
        'BeZhas Hub',
        'manage_options',
        'bezhas-hub',
        'bezhas_hub_console_page',
        'dashicons-networking',
        56
    );
    add_submenu_page('bezhas-hub', 'Consola', 'Consola', 'manage_options', 'bezhas-hub', 'bezhas_hub_console_page');
    add_submenu_page('bezhas-hub', 'Ajustes', 'Ajustes', 'manage_options', 'bezhas-hub-settings', 'bezhas_hub_settings_page');
});

function bezhas_hub_console_page() {
    require_once BEZHAS_HUB_PLUGIN_DIR . 'includes/console-page.php';
}

function bezhas_hub_settings_page() {
    require_once BEZHAS_HUB_PLUGIN_DIR . 'includes/admin-settings.php';
}

/**
 * Carga el JS/CSS de la consola SOLO en la página del plugin, y le pasa la
 * config (API base, nonce REST, ruta del bridge) vía wp_localize_script.
 */
add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos($hook, 'bezhas-hub') === false) {
        return;
    }
    wp_enqueue_style('bezhas-console', BEZHAS_HUB_PLUGIN_URL . 'assets/console.css', [], BEZHAS_HUB_VERSION);
    wp_enqueue_script('bezhas-console', BEZHAS_HUB_PLUGIN_URL . 'assets/console.js', [], BEZHAS_HUB_VERSION, true);
    wp_localize_script('bezhas-console', 'BeZhasHub', [
        'restBase' => esc_url_raw(rest_url('bezhas/v1')),
        'nonce'    => wp_create_nonce('wp_rest'),
        'apiBase'  => BEZHAS_HUB_API_BASE,
        'version'  => BEZHAS_HUB_VERSION,
        'store'    => get_bloginfo('name'),
    ]);
});

/**
 * Declara compatibilidad con WooCommerce HPOS (High-Performance Order Storage),
 * requisito de las versiones modernas de WooCommerce para gateways.
 */
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

register_activation_hook(__FILE__, function () {
    update_option('bezhas_hub_version', BEZHAS_HUB_VERSION);
    if (!get_option('bezhas_hub_webhook_secret')) {
        update_option('bezhas_hub_webhook_secret', wp_generate_uuid4());
    }
});
