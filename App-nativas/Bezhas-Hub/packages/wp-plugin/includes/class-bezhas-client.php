<?php
/**
 * BeZhas_Client — cliente HTTP central hacia api.bez.digital.
 *
 * - Guarda y lee la configuración del tenant (API-Key, red, BeZhas_ID).
 * - Firma cada petición con la API-Key scoped (NUNCA toca claves privadas).
 * - Cachea el manifiesto (planes + SubApps + pago) 5 min en transient.
 *
 * @package BeZhas_Hub
 * @license GPLv2 or later
 */

defined('ABSPATH') || exit;

class BeZhas_Client {

    const OPT_API_KEY    = 'bezhas_hub_api_key';
    const OPT_NETWORK    = 'bezhas_hub_network';
    const OPT_BEZHAS_ID  = 'bezhas_hub_bezhas_id';
    const OPT_PLAN       = 'bezhas_hub_active_plan';
    const OPT_SUBAPPS    = 'bezhas_hub_active_subapps';
    const MANIFEST_TKEY  = 'bezhas_hub_manifest';

    public static function api_base() {
        return defined('BEZHAS_HUB_API_BASE') ? BEZHAS_HUB_API_BASE : 'https://api.bez.digital';
    }

    public static function api_key() {
        return (string) get_option(self::OPT_API_KEY, '');
    }

    public static function network() {
        return (string) get_option(self::OPT_NETWORK, 'polygon');
    }

    public static function is_connected() {
        return self::api_key() !== '';
    }

    /** SubApps activadas localmente (espejo del scope de la API-Key). */
    public static function active_subapps() {
        $v = get_option(self::OPT_SUBAPPS, []);
        return is_array($v) ? $v : [];
    }

    /**
     * Petición autenticada al Hub.
     *
     * @param string $method GET|POST
     * @param string $path   ej. '/api/plans'
     * @param array  $body   payload (para POST)
     * @return array|WP_Error  ['code'=>int,'data'=>array]
     */
    public static function request($method, $path, $body = null) {
        $url  = rtrim(self::api_base(), '/') . '/' . ltrim($path, '/');
        $args = [
            'method'  => strtoupper($method),
            'timeout' => 30,
            'headers' => [
                // El Hub autentica máquina-a-máquina por X-API-Key; mantenemos
                // Bearer por compatibilidad con endpoints que lo esperen.
                'X-API-Key'      => self::api_key(),
                'Authorization'  => 'Bearer ' . self::api_key(),
                'Content-Type'   => 'application/json',
                'X-Bezhas-Plugin'=> defined('BEZHAS_HUB_VERSION') ? BEZHAS_HUB_VERSION : '2.0.0',
            ],
        ];
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }

        $res = wp_remote_request($url, $args);
        if (is_wp_error($res)) {
            return $res;
        }

        $code = wp_remote_retrieve_response_code($res);
        $data = json_decode(wp_remote_retrieve_body($res), true);
        return ['code' => $code, 'data' => is_array($data) ? $data : []];
    }

    /**
     * Manifiesto del Hub (planes + SubApps + config de pago). Cacheado 5 min.
     * Es PÚBLICO (no requiere API-Key) — se usa para pintar la consola aunque
     * el tenant aún no haya conectado su cuenta.
     *
     * @param bool $force  ignora caché
     */
    public static function manifest($force = false) {
        if (!$force) {
            $cached = get_transient(self::MANIFEST_TKEY);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $res = self::request('GET', '/api/plugin-bridge/manifest');
        if (is_wp_error($res) || empty($res['data']['manifest'])) {
            return null;
        }

        $manifest = $res['data']['manifest'];
        set_transient(self::MANIFEST_TKEY, $manifest, 5 * MINUTE_IN_SECONDS);
        return $manifest;
    }

    /** Estado real de conexión: ping al bridge + validación de API-Key. */
    public static function health() {
        $res = self::request('GET', '/api/plugin-bridge/health');
        if (is_wp_error($res)) {
            return ['online' => false, 'reason' => $res->get_error_message()];
        }
        $online = ($res['code'] === 200) && !empty($res['data']['status']);
        return [
            'online'    => $online,
            'connected' => self::is_connected(),
            'version'   => $res['data']['version'] ?? null,
            'plan'      => get_option(self::OPT_PLAN, null),
        ];
    }
}
