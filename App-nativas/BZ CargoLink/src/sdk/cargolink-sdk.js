import { cargoGateway } from '../services/cargoGateway'

export class CargoLinkSdk {
  constructor({ apiKey } = {}) {
    if (!apiKey) throw new Error('CargoLinkSdk requires an apiKey')
    this.apiKey = apiKey
  }

  auditFingerprint(payload) {
    return cargoGateway.auditFingerprint(payload, this.apiKey)
  }

  validateStowage(payload) {
    return cargoGateway.validateStowage(payload, this.apiKey)
  }

  dispatchCustoms(payload) {
    return cargoGateway.dispatchCustoms(payload, this.apiKey)
  }

  getActiveRoute(payload) {
    return cargoGateway.getActiveRoute(payload, this.apiKey)
  }
}

export default CargoLinkSdk
