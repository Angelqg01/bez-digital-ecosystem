/**
 * @bezhas/sdk — tipados del cliente oficial del BeZhas Hub.
 * Superficie espejo del contrato OpenAPI (backend/openapi.json).
 */

export interface BezhasHubClientOptions {
    /** Base del API. Por defecto: https://api.bez.digital/api */
    baseUrl?: string;
    /** API Key del Developer Portal (header X-API-Key). */
    apiKey?: string;
    /** JWT opcional (Authorization: Bearer …). */
    jwt?: string;
    /** Timeout por petición en ms (por defecto 30000). */
    timeoutMs?: number;
    /** Implementación fetch alternativa (tests/polyfills). */
    fetch?: typeof fetch;
}

export interface RequestOptions {
    query?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
    headers?: Record<string, string>;
}

/** Respuesta JSON genérica del Hub. */
export type HubResponse<T = unknown> = Promise<T>;

export interface EndpointDef {
    method: string;
    path: string;
}

export declare const ENDPOINTS: Record<string, EndpointDef>;
export declare const DEFAULT_BASE_URL: string;

export declare class BezhasHubError extends Error {
    name: 'BezhasHubError';
    status?: number;
    body?: unknown;
    path?: string;
}

export declare class BezhasHubClient {
    constructor(opts?: BezhasHubClientOptions);

    baseUrl: string;
    apiKey?: string;
    jwt?: string;
    timeoutMs: number;

    /** Petición HTTP de bajo nivel contra el Hub. */
    request<T = unknown>(method: string, path: string, opts?: RequestOptions): HubResponse<T>;

    health: {
        get(opts?: RequestOptions): HubResponse;
        live(opts?: RequestOptions): HubResponse;
        ready(opts?: RequestOptions): HubResponse;
    };

    escrow: {
        create(opts?: RequestOptions): HubResponse;
        get(serviceId: string | number, opts?: RequestOptions): HubResponse;
        finalize(serviceId: string | number, opts?: RequestOptions): HubResponse;
        dispute(serviceId: string | number, opts?: RequestOptions): HubResponse;
        stats(opts?: RequestOptions): HubResponse;
    };

    developers: {
        register(opts?: RequestOptions): HubResponse;
        keys(opts?: RequestOptions): HubResponse;
        generate(opts?: RequestOptions): HubResponse;
        playground(opts?: RequestOptions): HubResponse;
    };

    clothingRental: {
        create(opts?: RequestOptions): HubResponse;
        byCustomer(walletAddress: string, opts?: RequestOptions): HubResponse;
        byMerchant(walletAddress: string, opts?: RequestOptions): HubResponse;
        get(rentalId: string, opts?: RequestOptions): HubResponse;
        initiateAegis(rentalId: string, opts?: RequestOptions): HubResponse;
        aegisStatus(rentalId: string, opts?: RequestOptions): HubResponse;
        merchantDecision(rentalId: string, opts?: RequestOptions): HubResponse;
        recordPayment(rentalId: string, opts?: RequestOptions): HubResponse;
        processReturn(rentalId: string, opts?: RequestOptions): HubResponse;
        addReview(rentalId: string, opts?: RequestOptions): HubResponse;
        pendingAegis(opts?: RequestOptions): HubResponse;
        stats(opts?: RequestOptions): HubResponse;
        categories(opts?: RequestOptions): HubResponse;
    };

    web3: {
        health(opts?: RequestOptions): HubResponse;
        status(opts?: RequestOptions): HubResponse;
        indexerStats(opts?: RequestOptions): HubResponse;
        indexerEvents(opts?: RequestOptions): HubResponse;
        queueStats(opts?: RequestOptions): HubResponse;
    };
}
