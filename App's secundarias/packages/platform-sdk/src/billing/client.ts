export interface BillingClientConfig {
  gatewayUrl?: string;
  token?: string;
  walletAddress?: string;
  apiKey?: string;
}

export interface AIUsagePayload {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  images?: number;
  hdImages?: number;
  minutes?: number;
}

export interface AIChargeRequest {
  model: string;
  usage: AIUsagePayload;
  feature?: string;
  projectId?: string;
}

export interface BEZCreditPackage {
  id: string;
  name: string;
  eurAmount: number;
  bezCredits: number;
  bonusPct: number;
  recommendedFor: string[];
}

const DEFAULT_GATEWAY_URL = typeof window !== 'undefined'
  ? ((window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api')
  : (process.env.NEXT_PUBLIC_GATEWAY_API_URL || 'http://localhost:3001/api');

export class BeZhasBillingClient {
  private gatewayUrl: string;
  private token?: string;
  private walletAddress?: string;
  private apiKey?: string;

  constructor(config: BillingClientConfig = {}) {
    this.gatewayUrl = (config.gatewayUrl || DEFAULT_GATEWAY_URL).replace(/\/$/, '');
    this.token = config.token;
    this.walletAddress = config.walletAddress;
    this.apiKey = config.apiKey;
  }

  setAuth({ token, walletAddress, apiKey }: Partial<BillingClientConfig>) {
    if (token !== undefined) this.token = token;
    if (walletAddress !== undefined) this.walletAddress = walletAddress;
    if (apiKey !== undefined) this.apiKey = apiKey;
  }

  getCoreMetadata() {
    return this.request('/billing/core');
  }

  getCoreBEZBalance(address = this.walletAddress) {
    if (!address) throw new Error('walletAddress is required');
    return this.request(`/billing/core/balance/${address}`);
  }

  getCreditPackages() {
    return this.request('/billing/packages');
  }

  checkoutCreditPackage(packageId: string) {
    return this.request(`/billing/packages/${packageId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress: this.walletAddress }),
    });
  }

  getBalance() {
    return this.request('/billing/balance');
  }

  getHistory(params: Record<string, string | number | undefined> = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) qs.set(key, String(value));
    });
    return this.request(`/billing/history${qs.size ? `?${qs.toString()}` : ''}`);
  }

  getAIUsageSummary() {
    return this.request('/billing/ai/summary');
  }

  estimateAIUsage(model: string, usage: AIUsagePayload) {
    return this.request('/billing/ai/estimate', {
      method: 'POST',
      body: JSON.stringify({ model, usage }),
    });
  }

  chargeAIUsage(params: AIChargeRequest) {
    return this.request('/billing/ai/charge', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  addFiatFunds(amount: number) {
    return this.request('/billing/add-fiat-funds', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  addBezFunds(amount: number, txHash: string) {
    return this.request('/billing/add-bez-funds', {
      method: 'POST',
      body: JSON.stringify({ amount, txHash }),
    });
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };

    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.walletAddress) headers['x-wallet-address'] = this.walletAddress;
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const response = await fetch(`${this.gatewayUrl}${path}`, {
      ...init,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as any).error)
        : `Billing request failed with ${response.status}`;
      throw new Error(message);
    }

    return payload;
  }
}

export function createBillingClient(config: BillingClientConfig = {}) {
  return new BeZhasBillingClient(config);
}
