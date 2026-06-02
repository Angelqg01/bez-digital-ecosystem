'use client';

/**
 * components/GoogleAnalytics.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * GA4 integration that respects the EU cookie consent stored by the
 * CookieBanner in app/(landing)/layout.tsx.
 *
 * Behaviour:
 *  - If consent = 'accepted'  → Load GA4 in full mode (analytics + ads)
 *  - If consent = 'necessary' → Load GA4 in anonymized / no-storage mode
 *  - If consent = null        → Do NOT load GA4 at all
 *
 * GA4 Measurement ID is read from NEXT_PUBLIC_GA_MEASUREMENT_ID.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Script from 'next/script';
import { useEffect, useState } from 'react';

const COOKIE_CONSENT_KEY = 'bezhas_cookie_consent';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type ConsentState = 'accepted' | 'necessary' | null;

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

function pushGtagConsent(consentState: ConsentState) {
    if (typeof window === 'undefined' || !window.gtag) return;

    if (consentState === 'accepted') {
        // Full analytics + ads measurement
        window.gtag('consent', 'update', {
            analytics_storage: 'granted',
            ad_storage: 'denied', // never grant ads storage on B2B platforms
        });
    } else {
        // Cookieless, anonymized — still useful for aggregate traffic
        window.gtag('consent', 'update', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
        });
    }
}

export default function GoogleAnalytics() {
    const [consent, setConsent] = useState<ConsentState>(null);

    useEffect(() => {
        // Read initial consent
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentState | null;
        if (stored === 'accepted' || stored === 'necessary') {
            setConsent(stored);
        }

        // Listen for changes (e.g. user updates consent later)
        const handler = () => {
            const updated = localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentState | null;
            if (updated === 'accepted' || updated === 'necessary') {
                setConsent(updated);
                pushGtagConsent(updated);
            }
        };
        window.addEventListener('bezhas:consentUpdate', handler);
        return () => window.removeEventListener('bezhas:consentUpdate', handler);
    }, []);

    // Update GA4 consent whenever it changes
    useEffect(() => {
        if (consent !== null) pushGtagConsent(consent);
    }, [consent]);

    // Never load GA4 if no GA ID is configured OR consent not given
    if (!GA_ID || consent === null) return null;

    return (
        <>
            {/* Google tag (gtag.js) — loaded only after consent given */}
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
                onLoad={() => {
                    window.dataLayer = window.dataLayer || [];
                    window.gtag = function () { window.dataLayer.push(arguments); };
                    // Initialize with default denied consent (EU GDPR baseline)
                    window.gtag('consent', 'default', {
                        analytics_storage: 'denied',
                        ad_storage: 'denied',
                    });
                    window.gtag('js', new Date());
                    window.gtag('config', GA_ID, {
                        anonymize_ip: true,
                        send_page_view: true,
                    });
                    // Apply actual user consent immediately after init
                    if (consent) pushGtagConsent(consent);
                }}
            />
        </>
    );
}
