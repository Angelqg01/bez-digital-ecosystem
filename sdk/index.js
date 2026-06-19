// PLACEHOLDER for the canonical @bezhas/sdk.
//
// The real SDK source is not committed to this repo, yet frontend-next imports
// `{ BeZhasSDK }` from it (5 files). This stub lets the workspace install and
// build instead of failing at ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND. Any property
// access returns a no-op so a build (incl. Next SSG) does not crash. Replace
// this directory with the real @bezhas/sdk package when available.

const noop = () => undefined;

export class BeZhasSDK {
  constructor(config = {}) {
    this.config = config;
    // Return a permissive proxy: unknown methods/props resolve to a no-op,
    // so callers in frontend-next neither throw nor break the build.
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return noop;
      },
    });
  }
}

export default BeZhasSDK;
