<?php
/**
 * BeZhas Entitlements helper (WordPress / WooCommerce).
 *
 * The PHP mirror of src/subscription.js: fetches which SubApps the store's
 * subscription has activated, and gates features so the plugin only shows /
 * enables what the client actually pays for — the same contract enforced by the
 * SDK and the gateway. Drop-in: require this file, then:
 *
 *   $ent = BeZhas_Entitlements::fetch($api_key, $base_url);
 *   if ($ent->allows('cargolink')) { // show the CargoLink tracking block }
 *
 * Core SubApps (hub, wallet) are always allowed. Results are cached in a
 * transient for 5 minutes so we don't hit the gateway on every page load.
 */

if (!defined('ABSPATH')) exit;

class BeZhas_Entitlements {
    /** @var string[] Always-included SubApps (match CORE_SUBAPPS in subscription.js). */
    const CORE = ['hub', 'wallet'];

    /** @var string[] */
    private $subapps;

    public function __construct(array $subapps = []) {
        $this->subapps = array_values(array_unique(array_merge(self::CORE, $subapps)));
    }

    /** True if the subscription may use this SubApp. */
    public function allows(string $subapp): bool {
        return in_array($subapp, $this->subapps, true);
    }

    /** @return string[] */
    public function list(): array {
        sort($this->subapps);
        return $this->subapps;
    }

    /**
     * Fetch entitlements from GET /api/gateway/v1/subscription (cached 5 min).
     * Falls back to core-only on any error so the store never hard-breaks.
     */
    public static function fetch(string $api_key, string $base_url = 'https://api.bez.digital'): self {
        $cache_key = 'bezhas_entitlements_' . md5($api_key);
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return new self($cached);
        }

        $resp = wp_remote_get(rtrim($base_url, '/') . '/api/gateway/v1/subscription', [
            'headers' => ['x-api-key' => $api_key, 'Accept' => 'application/json'],
            'timeout' => 10,
        ]);

        if (is_wp_error($resp) || wp_remote_retrieve_response_code($resp) !== 200) {
            return new self([]); // core-only fallback
        }

        $body = json_decode(wp_remote_retrieve_body($resp), true);
        $subapps = $body['subapps'] ?? $body['active'] ?? $body['addons'] ?? [];
        if (!is_array($subapps)) $subapps = [];

        set_transient($cache_key, $subapps, 5 * MINUTE_IN_SECONDS);
        return new self($subapps);
    }

    /** Activate a SubApp on the subscription (POST). Returns decoded body or WP_Error. */
    public static function activate(string $api_key, string $subapp, string $base_url = 'https://api.bez.digital') {
        $resp = wp_remote_post(rtrim($base_url, '/') . '/api/gateway/v1/subscription/activate', [
            'headers' => ['x-api-key' => $api_key, 'Content-Type' => 'application/json'],
            'body'    => wp_json_encode(['subapp' => $subapp]),
            'timeout' => 15,
        ]);
        if (is_wp_error($resp)) return $resp;
        // Bust the cache so the next fetch() reflects the change.
        delete_transient('bezhas_entitlements_' . md5($api_key));
        return json_decode(wp_remote_retrieve_body($resp), true);
    }
}
