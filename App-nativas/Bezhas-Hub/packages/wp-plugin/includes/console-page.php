<?php
/**
 * Consola embebida de BeZhas-Hub dentro de wp-admin.
 *
 * El HTML es un contenedor; assets/console.js lo hidrata consumiendo el REST
 * bridge (manifiesto, conexión, planes, SubApps, pago). Toda la lógica vive en
 * el JS para mantener este archivo declarativo.
 *
 * @package BeZhas_Hub
 */

defined('ABSPATH') || exit;

$connected = BeZhas_Client::is_connected();
$network   = BeZhas_Client::network();
?>
<div class="wrap bezhas-console" id="bezhas-console-root" data-connected="<?php echo $connected ? '1' : '0'; ?>">
    <div class="bezhas-hero">
        <div class="bezhas-hero-title">
            <span class="bezhas-logo">◐</span>
            <div>
                <h1>BeZhas Hub</h1>
                <p>Todo el ecosistema BeZhas dentro de tu plataforma — sin salir de aquí.</p>
            </div>
        </div>
        <div class="bezhas-status" id="bezhas-status">
            <span class="dot"></span> <span class="label"><?php esc_html_e('Comprobando conexión…', 'bezhas-hub'); ?></span>
        </div>
    </div>

    <!-- Conexión (si no hay API-Key) -->
    <section class="bezhas-card" id="bezhas-connect" hidden>
        <h2><?php esc_html_e('Conecta tu cuenta BeZhas', 'bezhas-hub'); ?></h2>
        <p><?php
            printf(
                /* translators: %s: link a la Developer Console */
                esc_html__('Pega tu API Key de la %s para activar planes, SubApps y pagos.', 'bezhas-hub'),
                '<a href="https://bez.digital/developer-console" target="_blank" rel="noopener">Developer Console</a>'
            );
        ?></p>
        <div class="bezhas-field">
            <input type="password" id="bezhas-apikey" placeholder="bez_live_..." autocomplete="off" />
            <select id="bezhas-network">
                <option value="polygon">Polygon (recomendado)</option>
                <option value="bsc">BNB Chain</option>
            </select>
            <button class="button button-primary" id="bezhas-connect-btn"><?php esc_html_e('Conectar', 'bezhas-hub'); ?></button>
        </div>
    </section>

    <!-- Tabs -->
    <nav class="bezhas-tabs" id="bezhas-tabs" hidden>
        <button class="bezhas-tab is-active" data-tab="plans"><?php esc_html_e('Planes', 'bezhas-hub'); ?></button>
        <button class="bezhas-tab" data-tab="subapps"><?php esc_html_e('SubApps', 'bezhas-hub'); ?></button>
        <button class="bezhas-tab" data-tab="pay">BeZhas-Pay</button>
    </nav>

    <section class="bezhas-card bezhas-pane" id="pane-plans" hidden>
        <h2><?php esc_html_e('Planes de suscripción', 'bezhas-hub'); ?></h2>
        <label class="bezhas-toggle-inline">
            <input type="checkbox" id="bezhas-paybez" checked /> <?php esc_html_e('Pagar con $BEZ (−20%)', 'bezhas-hub'); ?>
        </label>
        <label class="bezhas-toggle-inline">
            <input type="checkbox" id="bezhas-annual" /> <?php esc_html_e('Facturación anual (2 meses gratis)', 'bezhas-hub'); ?>
        </label>
        <div class="bezhas-grid" id="bezhas-plans"></div>
    </section>

    <section class="bezhas-card bezhas-pane" id="pane-subapps" hidden>
        <h2><?php esc_html_e('SubApps del ecosistema', 'bezhas-hub'); ?></h2>
        <p class="bezhas-muted"><?php esc_html_e('Activa una SubApp para ampliar el scope de tu cuenta. Se consumen como servicios remotos del Hub.', 'bezhas-hub'); ?></p>
        <div class="bezhas-grid" id="bezhas-subapps"></div>
    </section>

    <section class="bezhas-card bezhas-pane" id="pane-pay" hidden>
        <h2>BeZhas-Pay</h2>
        <p class="bezhas-muted"><?php esc_html_e('Crea un cobro en BEZ. Para incrustarlo en una página usa el shortcode:', 'bezhas-hub'); ?> <code>[bezhas_pay amount="49.90" currency="EUR"]</code></p>
        <div class="bezhas-field">
            <input type="number" id="bezhas-pay-amount" placeholder="49.90" step="0.01" min="0" />
            <select id="bezhas-pay-currency">
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
            </select>
            <button class="button button-primary" id="bezhas-pay-btn"><?php esc_html_e('Crear cobro', 'bezhas-hub'); ?></button>
        </div>
        <div id="bezhas-pay-result" class="bezhas-muted"></div>
    </section>
</div>
