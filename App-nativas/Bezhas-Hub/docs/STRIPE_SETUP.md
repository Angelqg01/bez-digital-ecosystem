# Stripe setup and local verification

This guide gets Stripe working locally for both Checkout Sessions (content validation) and Payment Intents (BEZ purchases).

## 1) Required environment variables

Create/update your env files.

Backend (.env):

- STRIPE_SECRET_KEY=sk_test_xxx
- STRIPE_WEBHOOK_SECRET=whsec_xxx
- FRONTEND_URL=http://localhost:5173
- ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

Notes:
- STRIPE_SECRET_KEY: account-level test secret key.
- STRIPE_WEBHOOK_SECRET: generated when you create a webhook endpoint pointing to /api/payment/webhook.
- FRONTEND_URL: used to build success/cancel URLs for Checkout.
- ALLOWED_ORIGINS: comma-separated list; dev URLs already whitelisted by default.

Frontend (.env):

- VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
- VITE_API_URL=http://localhost:3001/api

Notes:
- VITE_STRIPE_PUBLIC_KEY must start with pk_.
- VITE_ prefix is required by Vite to expose env variables to the browser.

## 2) Install dependencies and run

- Frontend requires @stripe/stripe-js (already added to package.json).

### Backend

- Start backend (port 3001 by default). Ensure the /api/payment routes are reachable.

### Frontend

- Start frontend (Vite on 5173). The dev proxy forwards /api to http://localhost:3001.

## 3) Configure Stripe webhook for local dev

- Create a webhook endpoint in Stripe pointing to:
  - http://localhost:3001/api/payment/webhook
- Select at least these events:
  - checkout.session.completed
  - payment_intent.succeeded
  - payment_intent.payment_failed
- Copy the signing secret (starts with whsec_) to STRIPE_WEBHOOK_SECRET in backend .env.

Important:
- Our server uses express.raw for /api/payment/webhook and skips global JSON parsing on that route, so signature verification works.

## 4) Flows to test

### A) Checkout Session (content validation)

- From the UI, open the content validation modal and choose FIAT.
- Backend endpoint used: POST /api/payment/create-validation-session
- Expected sequence:
  1. Browser receives a sessionId and redirects to Stripe Checkout.
  2. After a successful payment, Stripe sends checkout.session.completed to /api/payment/webhook.
  3. Backend queues the blockchain validation (see logs: "Validation queued successfully").

Verification:
- Check server logs contain: "Stripe checkout session created successfully" and later "Validation queued successfully".
- You should see a successful event in the Stripe dashboard for your test checkout.

### B) Payment Intents (BEZ purchase)

- Frontend service posts to: POST /api/payment/stripe/create-payment-intent
  - Body: { amount, currency, walletAddress, metadata }
- Backend creates a PaymentIntent and returns: { clientSecret, paymentIntentId }.
- Use clientSecret with Stripe.js to confirm card payment (Elements or redirect/hosted mechanisms if implemented).

Verification:
- Check server logs contain: "Stripe Payment Intent created".
- In Stripe dashboard, you should see a PaymentIntent created and, once confirmed, a payment_intent.succeeded event delivered to the webhook.

## 5) Troubleshooting

- 400 on webhook: Ensure STRIPE_WEBHOOK_SECRET matches the one from Stripe and that the request body is not JSON-parsed before express.raw.
- CSP blocking Stripe: Production CSP in server.js allows js.stripe.com (script/frame), api.stripe.com (connect), and hooks/checkout for frameSrc.
- Vite env not found: Restart dev server after adding/updating .env files. Use import.meta.env.VITE_… on the frontend.
- Mixed content/redirects: FRONTEND_URL should be the same host/port where Vite is running in dev.

## 6) Going live

- Replace test keys with live keys in a production-only env.
- Update FRONTEND_URL to your production origin and reconfigure your live webhook.
- Keep CSP domains for Stripe; add any additional subdomains if Stripe introduces them.
