// Wrapper fino sobre @bezhas/guided-tour para BZ CargoLink.
// La mecánica (modal, autoplay, auto-show) vive en el paquete compartido; aquí
// solo se fijan los valores de esta SubApp. El contenido de las escenas está en
// tour.config.mjs → public/como-usar.html (regenerar con `pnpm tour:build`).
import React from 'react'
import { GuidedTour as BaseGuidedTour, TourButton as BaseTourButton } from '@bezhas/guided-tour/react'

const EVENT = 'cargolink:start-tour'
const SEEN_KEY = 'cargolink_tour_seen_v1'

export default function GuidedTour() {
  return (
    <BaseGuidedTour
      appName="BZ CargoLink"
      src="/como-usar.html"
      eventName={EVENT}
      seenKey={SEEN_KEY}
    />
  )
}

export function TourButton({ compact = false }) {
  return <BaseTourButton compact={compact} eventName={EVENT} label="CÓMO USAR" />
}
