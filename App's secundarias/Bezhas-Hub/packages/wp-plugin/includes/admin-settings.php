<?php
/**
 * Página de Ajustes — estado REAL de conexión (ping al Hub) + accesos.
 *
 * @package BeZhas_Hub
 */

defined('ABSPATH') || exit;

$health    = BeZhas_Client::health();
$online    = !empty($health['online']);
$connected = !empty($health['connected']);
$plan      = $health['plan'] ?? null;
$subapps   = BeZhas_Client::active_subapps();

$dot   = $online ? '#1a9d57' : '#c0392b';
$state = $online
    ? ($connected ? __('Conectado a BeZhas Network', 'bezhas-hub') : __('Hub accesible — falta API Key', 'bezhas-hub'))
    : __('Sin conexión con el Hub', 'bezhas-hub');
?>
<div class="wrap">
    <h1>BeZhas Hub — Ajustes</h1>
    <table class="form-table">
        <tr>
            <th><?php esc_html_e('Estado', 'bezhas-hub'); ?></th>
            <td><span style="color:<?php echo esc_attr($dot); ?>;">&#9679;</span> <?php echo esc_html($state); ?></td>
        </tr>
        <tr>
            <th><?php esc_html_e('Plan activo', 'bezhas-hub'); ?></th>
            <td><?php echo $plan ? esc_html($plan) : '<em>' . esc_html__('ninguno', 'bezhas-hub') . '</em>'; ?></td>
        </tr>
        <tr>
            <th><?php esc_html_e('SubApps activas', 'bezhas-hub'); ?></th>
            <td><?php echo $subapps ? esc_html(implode(', ', array_keys($subapps))) : '<em>' . esc_html__('ninguna', 'bezhas-hub') . '</em>'; ?></td>
        </tr>
        <tr>
            <th><?php esc_html_e('Versión del Plugin', 'bezhas-hub'); ?></th>
            <td><?php echo esc_html(BEZHAS_HUB_VERSION); ?></td>
        </tr>
        <tr>
            <th><?php esc_html_e('Consola', 'bezhas-hub'); ?></th>
            <td><a href="<?php echo esc_url(admin_url('admin.php?page=bezhas-hub')); ?>"><?php esc_html_e('Abrir consola embebida', 'bezhas-hub'); ?></a></td>
        </tr>
        <?php if (class_exists('WC_Payment_Gateway')) : ?>
        <tr>
            <th><?php esc_html_e('Gateway WooCommerce', 'bezhas-hub'); ?></th>
            <td><a href="<?php echo esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=bezhas')); ?>"><?php esc_html_e('Configurar gateway', 'bezhas-hub'); ?></a></td>
        </tr>
        <?php endif; ?>
        <tr>
            <th>Developer Console</th>
            <td><a href="https://bez.digital/developer-console" target="_blank" rel="noopener"><?php esc_html_e('Abrir en BeZhas Hub', 'bezhas-hub'); ?></a></td>
        </tr>
    </table>
</div>
