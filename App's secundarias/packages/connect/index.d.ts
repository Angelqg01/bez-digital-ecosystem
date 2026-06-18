// Type definitions for @bezhas/connect

export interface BeZhasConnectOptions {
  /** Registered-app API key (sent as gateway `x-api-key`). */
  apiKey?: string;
  /** Optional cross-app SSO JWT for user context (sent as Authorization). */
  userToken?: string;
  /** API host override. Default: https://api.bez.digital */
  baseUrl?: string;
  /** Per-request timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Inject a fetch implementation (tests / runtimes without global fetch). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  /** Per-call bearer (CargoLink role-scoped key) — overrides userToken. */
  bearer?: string;
  headers?: Record<string, string>;
}

export class BeZhasApiError extends Error {
  name: 'BeZhasApiError';
  status: number;
  body: unknown;
  endpoint: string | null;
}

export type PaymentMethod = 'card' | 'crypto' | 'qr' | 'bank';
export type ReceiveMethod = 'card' | 'bank' | 'crypto';

export interface BuyParams {
  amountUSD: number;
  paymentMethod: PaymentMethod;
  walletAddress?: string;
  stripeUseCase?: string;
  email?: string;
}

export interface BuyResult {
  success: boolean;
  paymentId: number;
  status: string;
  provider: string;
  checkoutUrl?: string;
  bankTransfer?: unknown;
  walletAddress: string;
  amountUSD: number;
  netAmountUSD: number;
  platformFeeUSD: number;
  nextAction: string;
  [k: string]: unknown;
}

export class PayModule {
  constructor(client: BeZhasConnect);
  buy(p: BuyParams): Promise<BuyResult>;
  sell(p: { walletAddress: string; amountBEZ: number; receiveMethod: ReceiveMethod }): Promise<any>;
  send(p: { sender: string; recipient: string; amount: number; note?: string }): Promise<any>;
  history(address: string, opts?: { limit?: number }): Promise<any>;
  tokenomics(opts?: { amountUSD?: number; priceUSD?: number }): Promise<any>;
  stripeLinks(): Promise<any>;
  bankTransferDetails(): Promise<any>;
  price(): Promise<any>;
}

export interface PosLinkParams {
  baseUrl: string;
  provider?: string;
  ordersPath?: string;
  apiKey?: string;
}

export class CargoLinkModule {
  constructor(client: BeZhasConnect, roleKey?: string);
  withRoleKey(roleKey: string): CargoLinkModule;
  health(): Promise<any>;
  linkPos(p: PosLinkParams, roleKey?: string): Promise<any>;
  getPosLink(roleKey?: string): Promise<any>;
  syncOrders(roleKey?: string): Promise<any>;
  createTx(tx: Record<string, unknown>, roleKey?: string): Promise<any>;
  listTx(query?: Record<string, unknown>, roleKey?: string): Promise<any>;
  getTx(bUid: string, roleKey?: string): Promise<any>;
  advanceTx(bUid: string, body?: Record<string, unknown>, roleKey?: string): Promise<any>;
  registerDevice(body: Record<string, unknown>, roleKey?: string): Promise<any>;
  ingestTelemetry(body: Record<string, unknown>, deviceKey?: string): Promise<any>;
  getTelemetry(query?: Record<string, unknown>, roleKey?: string): Promise<any>;
  registerWebhook(body: Record<string, unknown>, roleKey?: string): Promise<any>;
}

export class BeZhasConnect {
  constructor(opts?: BeZhasConnectOptions);
  apiKey: string | null;
  userToken: string | null;
  baseUrl: string;
  timeoutMs: number;
  pay: PayModule;
  cargolink: CargoLinkModule;
  request<T = any>(method: string, path: string, options?: RequestOptions): Promise<T>;
}

export const PAYMENT_METHODS: PaymentMethod[];
export const RECEIVE_METHODS: ReceiveMethod[];

export namespace webhooks {
  const SIGNATURE_HEADER: 'x-bezhas-signature';
  const EVENT_HEADER: 'x-bezhas-event';
  function sign(rawBody: string | Buffer, secret: string, withPrefix?: boolean): string;
  function verify(rawBody: string | Buffer, signature: string, secret: string): boolean;
  function verifyAndParse(rawBody: string | Buffer, signature: string, secret: string): any;
}

export default BeZhasConnect;
