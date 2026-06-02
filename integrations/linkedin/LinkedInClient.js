import fs from "node:fs";
import path from "node:path";

const LINKEDIN_API = "https://api.linkedin.com";
const LINKEDIN_OAUTH = "https://www.linkedin.com/oauth/v2";

export class LinkedInClient {
  constructor(env = process.env) {
    this.clientId = env.LINKEDIN_CLIENT_ID;
    this.clientSecret = env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = env.LINKEDIN_REDIRECT_URI || "http://localhost:3001/auth/linkedin/callback";
    this.scopes = (env.LINKEDIN_SCOPES || "openid profile email w_member_social")
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
    this.accessToken = env.LINKEDIN_ACCESS_TOKEN;
    this.organizationId = env.LINKEDIN_ORGANIZATION_ID;
    this.apiVersion = env.LINKEDIN_API_VERSION || "202601";
    this.dryRun = env.LINKEDIN_DRY_RUN !== "false";
  }

  hasAppCredentials() {
    return Boolean(this.clientId && this.clientSecret);
  }

  hasAccessToken() {
    return Boolean(this.accessToken);
  }

  authorizationUrl(state = cryptoRandomState()) {
    if (!this.clientId) {
      throw new Error("Missing LINKEDIN_CLIENT_ID");
    }

    const url = new URL(`${LINKEDIN_OAUTH}/authorization`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", this.scopes.join(" "));
    return url.toString();
  }

  async exchangeCode(code) {
    if (!this.hasAppCredentials()) {
      throw new Error("Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET");
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(`${LINKEDIN_OAUTH}/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    return this.parseResponse(response);
  }

  async getOpenIdProfile() {
    return this.request("/v2/userinfo");
  }

  async getRestMe() {
    return this.request("/v2/me");
  }

  async getOrganizationAcls() {
    return this.request("/rest/organizationAcls?q=roleAssignee", {
      headers: this.restHeaders(),
    });
  }

  async getOrganizationPosts() {
    if (!this.organizationId) {
      return { skipped: true, reason: "Missing LINKEDIN_ORGANIZATION_ID" };
    }

    const author = encodeURIComponent(`urn:li:organization:${this.organizationId}`);
    return this.request(`/rest/posts?author=${author}&q=author&count=10`, {
      headers: this.restHeaders(),
    });
  }

  async createMemberPost({ authorUrn, commentary, visibility = "PUBLIC" }) {
    if (this.dryRun) {
      return {
        dryRun: true,
        action: "createMemberPost",
        authorUrn,
        commentary,
        visibility,
      };
    }

    return this.request("/rest/posts", {
      method: "POST",
      headers: this.restHeaders(),
      body: JSON.stringify({
        author: authorUrn,
        commentary,
        visibility,
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
  }

  async request(resource, options = {}) {
    if (!this.accessToken) {
      throw new Error("Missing LINKEDIN_ACCESS_TOKEN. Run OAuth exchange first.");
    }

    const response = await fetch(`${LINKEDIN_API}${resource}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    return this.parseResponse(response);
  }

  restHeaders() {
    return {
      "LinkedIn-Version": this.apiVersion,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };
  }

  async parseResponse(response) {
    const text = await response.text();
    let payload = text;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      // Keep the raw response for diagnostics.
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        payload,
      };
    }

    return {
      ok: true,
      status: response.status,
      payload,
    };
  }
}

export function writeJsonReport(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function cryptoRandomState() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
