<?php
/**
 * BeZhas_REST — puente REST del plugin: /wp-json/bezhas/v1/*
 *
 * La consola embebida (assets/console.js) habla SOLO con estos endpoints
 * locales; WordPress reenvía al Hub firmando con la API-Key del tenant. Así la
 * API-Key nunca viaja al navegador del comerciante.
 *
 * Rutas (todas requieren capability manage_options + nonce wp_rest):
 *   GET  /manifest              → planes + SubApps + pago (cacheado)
 *   GET  /status                → estado real de conexión
 *   POST /connect               → guarda API-Key y valida contra el Hub
 *   POST /quote                 → cotiza una suscripción
 *   POST /subscribe             → contrata un plan (paga en $BEZ)
 *   POST /subapp/toggle         → activa/desactiva una SubApp (scope API-Key)
 *   POST /pay/intent            → crea un intent de pago BeZhas-Pay
 *
 * @package BeZhas_Hub
 * @license GPLv2 or later
 */

defined('ABSPATH') || exit;

class BeZhas_REST {

    const NS = 'bezhas/v1';

    public function register() {
        add_action('rest_api_init', [$this, 'routes']);
    }

    public function permission() {
        return current_user_can('manage_options');
    }

    public function routes() {
        $perm = [$this, 'permission'];

        register_rest_route(self::NS, '/manifest', [
            'methods'  => 'GET',
            'callback' => [$this, 'manifest'],
            'permission_callback' => $perm,
        ]);
        register_rest_route(self::NS, '/status', [
            'methods'  => 'GET',
            'callback' => [$this, 'status'],
            'permission_callback' => $perm,
        ]);
        register_rest_route(self::NS, '/connect', [
            'methods'  => 'POST',
            'callback' => [$this, 'connect'],
            'permission_callback' => $perm,
        ]);
        register_rest_route(self::NS, '/quote', [
            'methods'  => 'POST',
            'callback' => [$this, 'quote'],
            'permission_callback' => $perm,
        ]);
        register_rest_route(self::NS, '/subscribe', [
            'methods'  => 'POST',
            'callback' => [$this, 'subscribe'],
            'permission_callback' => $perm,
        ]);
        register_rest_route(self::NS, '/subapp/toggle', [
            'methods'  => 'POST',
            'callback' => [$this, 'toggle_subapp'],
            'permission_callback' => $perm,
        ]);
        register_rest_route(self::NS, '/pay/intent', [
            'methods'  => 'POST',
            'callback' => [$this, 'pay_intent'],
            'permission_callback' => $perm,
        ]);
        // Pago PÚBLICO para el shortcode/bloque [bezhas_pay] en el front de la
        // tienda. No exige manage_options (lo usan los clientes), pero está
        // rate-limited y usa la API-Key del comerciante SOLO en servidor.
        register_rest_route(self::NS, '/pay/checkout', [
            'methods'  => 'POST',
            'callback' => [$this, 'pay_checkout'],
            'permission_callback' => '__return_true',
        ]);
    }

    // ── GET /manifest ────────────────────────────────────────────────────────
    public function manifest() {
        $m = BeZhas_Client::manifest();
        if (!$m) {
            return new WP_REST_Response(['success' => false, 'message' => 'No se pudo cargar el manifiesto del Hub.'], 502);
        }
        $m['active'] = [
            'plan'    => get_option(BeZhas_Client::OPT_PLAN, null),
            'subapps' => BeZhas_Client::active_subapps(),
        ];
        return ['success' => true, 'manifest' => $m];
    }

    // ── GET /status ──────────────────────────────────────────────────────────
    public function status() {
        return ['success' => true, 'status' => BeZhas_Client::health()];
    }

    // ── POST /connect ────────────────────────────────────────────────────────
    public function connect(WP_REST_Request $req) {
        $api_key = sanitize_text_field($req->get_param('apiKey'));
        $network = sanitize_text_field($req->get_param('network') ?: 'polygon');
        if ($api_key === '') {
            return new WP_REST_Response(['success' => false, 'message' => 'API Key requerida.'], 400);
        }
        update_option(BeZhas_Client::OPT_API_KEY, $api_key);
        update_option(BeZhas_Client::OPT_NETWORK, in_array($network, ['polygon', 'bsc'], true) ? $network : 'polygon');

        // Valida la clave pidiendo la identidad del tenant al Hub.
        $res = BeZhas_Client::request('GET', '/api/identity/me');
        if (!is_wp_error($res) && $res['code'] === 200) {
            $bezhas_id = $res['data']['bezhasId'] ?? ($res['data']['id'] ?? null);
            if ($bezhas_id) {
                update_option(BeZhas_Client::OPT_BEZHAS_ID, sanitize_text_field($bezhas_id));
            }
        }
        delete_transient(BeZhas_Client::MANIFEST_TKEY);
        return ['success' => true, 'status' => BeZhas_Client::health()];
    }

    // ── POST /quote ──────────────────────────────────────────────────────────
    public function quote(WP_REST_Request $req) {
        $payload = [
            'planId'     => sanitize_text_field($req->get_param('planId')),
            'payWithBez' => (bool) $req->get_param('payWithBez'),
            'annual'     => (bool) $req->get_param('annual'),
        ];
        $res = BeZhas_Client::request('POST', '/api/plugin-bridge/quote', $payload);
        return $this->relay($res);
    }

    // ── POST /subscribe ──────────────────────────────────────────────────────
    public function subscribe(WP_REST_Request $req) {
        if (!BeZhas_Client::is_connected()) {
            return new WP_REST_Response(['success' => false, 'message' => 'Conecta tu cuenta BeZhas primero.'], 401);
        }
        $payload = [
            'planId'     => sanitize_text_field($req->get_param('planId')),
            'payWithBez' => (bool) $req->get_param('payWithBez'),
            'annual'     => (bool) $req->get_param('annual'),
            'source'     => 'wp-plugin',
            'store'      => get_bloginfo('name'),
        ];
        // Bridge autenticado por API-Key (sin el JWT de /api/subscription/checkout).
        $res = BeZhas_Client::request('POST', '/api/plugin-bridge/subscribe', $payload);
        if (!is_wp_error($res) && $res['code'] >= 200 && $res['code'] < 300) {
            update_option(BeZhas_Client::OPT_PLAN, $payload['planId']);
        }
        return $this->relay($res);
    }

    // ── POST /subapp/toggle ──────────────────────────────────────────────────
    public function toggle_subapp(WP_REST_Request $req) {
        if (!BeZhas_Client::is_connected()) {
            return new WP_REST_Response(['success' => false, 'message' => 'Conecta tu cuenta BeZhas primero.'], 401);
        }
        $key     = sanitize_key($req->get_param('key'));
        $enabled = (bool) $req->get_param('enabled');
        $scope   = sanitize_text_field($req->get_param('scope'));

        $res = BeZhas_Client::request('POST', '/api/plugin-bridge/subapp', [
            'key'     => $key,
            'scope'   => $scope,
            'enabled' => $enabled,
        ]);

        // Espejo local del estado (para pintar toggles aunque el Hub tarde).
        $active = BeZhas_Client::active_subapps();
        if ($enabled) {
            $active[$key] = true;
        } else {
            unset($active[$key]);
        }
        update_option(BeZhas_Client::OPT_SUBAPPS, $active);

        if (is_wp_error($res)) {
            // El estado local se guardó; informa pero no rompe la UI.
            return ['success' => true, 'local' => true, 'active' => array_keys($active)];
        }
        return ['success' => true, 'active' => array_keys($active), 'hub' => $res['data']];
    }

    // ── POST /pay/intent ─────────────────────────────────────────────────────
    public function pay_intent(WP_REST_Request $req) {
        if (!BeZhas_Client::is_connected()) {
            return new WP_REST_Response(['success' => false, 'message' => 'Conecta tu cuenta BeZhas primero.'], 401);
        }
        $amount   = (float) $req->get_param('amount');
        $currency = sanitize_text_field($req->get_param('currency') ?: 'EUR');
        if ($amount <= 0) {
            return new WP_REST_Response(['success' => false, 'message' => 'Importe inválido.'], 400);
        }
        // Endpoint canónico del Hub: el Control Plane lo reenvía a la Pay SubApp.
        $res = BeZhas_Client::request('POST', '/api/payment/create', [
            'amount'   => $amount,
            'amountUSD'=> $amount, // compat: la Pay SubApp cotiza por importe
            'currency' => $currency,
            'payToken' => 'BEZ',
            'network'  => BeZhas_Client::network(),
            'metadata' => ['store' => get_bloginfo('name'), 'source' => 'wp-plugin'],
        ]);
        return $this->relay($res);
    }

    // ── POST /pay/checkout (público, front de la tienda) ─────────────────────
    public function pay_checkout(WP_REST_Request $req) {
        if (!BeZhas_Client::is_connected()) {
            return new WP_REST_Response(['success' => false, 'message' => 'Pago no disponible.'], 503);
        }
        // Rate-limit por IP: máx. 10 intentos / minuto.
        $ip  = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
        $key = 'bezhas_pay_rl_' . md5($ip);
        $hits = (int) get_transient($key);
        if ($hits >= 10) {
            return new WP_REST_Response(['success' => false, 'message' => 'Demasiados intentos. Espera un momento.'], 429);
        }
        set_transient($key, $hits + 1, MINUTE_IN_SECONDS);

        $amount   = (float) $req->get_param('amount');
        $currency = sanitize_text_field($req->get_param('currency') ?: 'EUR');
        if ($amount <= 0 || $amount > 1000000) {
            return new WP_REST_Response(['success' => false, 'message' => 'Importe inválido.'], 400);
        }
        $res = BeZhas_Client::request('POST', '/api/payment/create', [
            'amount'   => $amount,
            'amountUSD'=> $amount,
            'currency' => $currency,
            'payToken' => 'BEZ',
            'network'  => BeZhas_Client::network(),
            'metadata' => ['store' => get_bloginfo('name'), 'source' => 'wp-shortcode'],
        ]);
        return $this->relay($res);
    }

    /** Reenvía la respuesta del Hub conservando código y cuerpo. */
    private function relay($res) {
        if (is_wp_error($res)) {
            return new WP_REST_Response(['success' => false, 'message' => $res->get_error_message()], 502);
        }
        $ok = $res['code'] >= 200 && $res['code'] < 300;
        return new WP_REST_Response(array_merge(['success' => $ok], $res['data']), $res['code'] ?: 500);
    }
}
