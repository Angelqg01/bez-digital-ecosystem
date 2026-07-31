import React from 'react';
import { GuidedTour as Base, TourButton as BaseBtn } from '@bezhas/guided-tour/react';

const EVENT = 'bezhas-hub:start-tour';
const SEEN = 'bezhas_hub_tour_seen_v1';

export default function GuidedTour() {
  return <Base appName="BeZhas Hub" src="/como-usar.html" eventName={EVENT} seenKey={SEEN} />;
}

export function TourButton({ compact = false }) {
  return <BaseBtn compact={compact} eventName={EVENT} label="CÓMO USAR" />;
}
