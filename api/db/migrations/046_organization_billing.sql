-- Migration 046: facturación de cliente final por organización.
--
-- Es distinta de `gateway_subscriptions` (migración 024/031): esa es 1:1 con
-- una `app_id` de app_registry — el "cliente" ahí es una SubApp/partner
-- técnico con API key, no una empresa. Aquí el cliente es la organización
-- misma contratando la plataforma, con NIF de facturación, método de pago y
-- facturación electrónica — el bloque "3. Datos Financieros y de Facturación"
-- del registro extendido.
--
-- Mismo patrón que 044/045: tabla propia colgando de organization_id, nada de
-- columnas sueltas en `organizations`.

CREATE TABLE IF NOT EXISTS organization_billing_profiles (
    id                              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id                 UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

    -- Cliente en Stripe. El método de pago (tarjeta/SEPA) se captura con un
    -- SetupIntent vía Stripe Elements en el frontend — el backend nunca ve un
    -- número de tarjeta o IBAN, solo guarda los ids que devuelve Stripe.
    stripe_customer_id              TEXT,
    stripe_default_payment_method_id TEXT,
    payment_method_type             VARCHAR(20) CHECK (payment_method_type IN ('card', 'sepa_debit', 'bank_transfer', 'crypto')),
    payment_method_last4            VARCHAR(4),   -- solo para mostrar "termina en ****", nunca el dato completo

    billing_email                   VARCHAR(255),

    -- Facturación electrónica: formato variable por jurisdicción (Facturae/SII
    -- en España, otros esquemas fuera) — JSONB en vez de una columna por
    -- campo posible, igual de flexible que `organization_credentials.metadata`.
    einvoicing_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
    einvoicing_format               VARCHAR(30) CHECK (einvoicing_format IN ('facturae', 'sii', 'other')),
    einvoicing_config               JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contactos administrativos/técnicos/de seguridad — varios por organización y
-- por tipo (p. ej. dos contactos técnicos), de ahí tabla aparte y no columnas.
CREATE TABLE IF NOT EXISTS organization_billing_contacts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_type        VARCHAR(20) NOT NULL CHECK (contact_type IN ('administrative', 'technical', 'security')),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(50),
    added_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_billing_contacts_org ON organization_billing_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_billing_contacts_type ON organization_billing_contacts(organization_id, contact_type);
