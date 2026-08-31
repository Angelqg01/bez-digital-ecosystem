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

export interface CapabilityAction {
  action: string;
  method: string;
  path: string;
  required: string[];
  auth: string;
  description: string;
}
export interface SubAppCapability {
  subapp: string;
  label: string;
  auth: 'apiKey' | 'roleKey' | 'public';
  actions: CapabilityAction[];
}

/** Generic invocation surface over the Capability Registry — drives any SubApp. */
export class ServiceModule {
  constructor(client: BeZhasConnect, subapp: string, opts?: { roleKey?: string });
  subapp: string;
  withRoleKey(roleKey: string): ServiceModule;
  actions(): string[];
  call<T = any>(action: string, params?: Record<string, unknown>): Promise<T>;
}

/** What a subscription allows — the set of activated SubApps (core always in). */
export class Entitlements {
  constructor(subapps?: Iterable<string>);
  subapps: Set<string>;
  allows(subapp: string): boolean;
  list(): string[];
  static fromPlan(planId: string, chosenAddons?: string[]): Entitlements;
  static fromApi(payload?: { subapps?: string[]; active?: string[]; addons?: string[] }): Entitlements;
}

/** Thrown when a call targets a SubApp the subscription has not activated. */
export class BeZhasEntitlementError extends Error {
  code: 'ENTITLEMENT_REQUIRED';
  subapp: string;
}

/** SubApps included in every subscription at no extra cost. */
export const CORE_SUBAPPS: string[];

/** Manage the plan + which SubApps are active. */
export class SubscriptionModule {
  constructor(client: BeZhasConnect);
  get<T = any>(): Promise<T>;
  sync(): Promise<Entitlements>;
  activate(subapp: string): Promise<any>;
  deactivate(subapp: string): Promise<any>;
  quote(opts: { planId: string; addons?: string[]; annual?: boolean }): Promise<any>;
}

export interface BeZhasConnectOptionsExt extends BeZhasConnectOptions {
  /** Gate service() to these SubApps (Entitlements | API payload | id[]). */
  entitlements?: Entitlements | string[] | { subapps?: string[]; active?: string[]; addons?: string[] };
}

export class BeZhasConnect {
  constructor(opts?: BeZhasConnectOptionsExt);
  apiKey: string | null;
  userToken: string | null;
  baseUrl: string;
  timeoutMs: number;
  pay: PayModule;
  cargolink: CargoLinkModule;
  subscription: SubscriptionModule;
  /** Generic accessor for ANY registered SubApp (pay | cargolink | energy | ...). */
  service(name: string, opts?: { roleKey?: string }): ServiceModule;
  /** Discover every SubApp + action this SDK can invoke (no secrets). */
  capabilities(): SubAppCapability[];
  /** Apply entitlements so service() is gated; pass null to disable. */
  setEntitlements(value: Entitlements | string[] | object | null): this;
  /** Current entitlements, or null if gating is off. */
  getEntitlements(): Entitlements | null;
  request<T = any>(method: string, path: string, options?: RequestOptions): Promise<T>;
}

export function listCapabilities(): SubAppCapability[];
export function getSubAppDescriptor(name: string): any;
export const REGISTRY: Record<string, any>;

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
