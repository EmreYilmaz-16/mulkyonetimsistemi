-- ============================================================
-- Multi-tenant SaaS foundation
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              VARCHAR(150) NOT NULL,
    slug              VARCHAR(160) UNIQUE NOT NULL,
    contact_email     VARCHAR(150),
    contact_phone     VARCHAR(20),
    subscription_plan VARCHAR(30) NOT NULL DEFAULT 'starter'
                        CHECK (subscription_plan IN ('starter','pro','enterprise')),
    max_users         INT NOT NULL DEFAULT 3,
    max_properties    INT NOT NULL DEFAULT 25,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    trial_ends_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO organizations (name, slug, contact_email, subscription_plan, max_users, max_properties)
VALUES ('Varsayilan Organizasyon', 'varsayilan-organizasyon', 'admin@kiratakip.local', 'enterprise', 50, 1000)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner','accountant','agent','admin','platform_admin'));

UPDATE users
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE buildings
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE properties p
SET organization_id = COALESCE(b.organization_id, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'))
FROM buildings b
WHERE p.building_id = b.id
  AND p.organization_id IS NULL;

UPDATE properties
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE tenants
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE contracts c
SET organization_id = COALESCE(p.organization_id, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'))
FROM properties p
WHERE c.property_id = p.id
  AND c.organization_id IS NULL;

UPDATE contracts
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE payments py
SET organization_id = COALESCE(c.organization_id, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'))
FROM contracts c
WHERE py.contract_id = c.id
  AND py.organization_id IS NULL;

UPDATE expenses e
SET organization_id = COALESCE(p.organization_id, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'))
FROM properties p
WHERE e.property_id = p.id
  AND e.organization_id IS NULL;

UPDATE expenses
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE maintenance_requests mr
SET organization_id = COALESCE(p.organization_id, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'))
FROM properties p
WHERE mr.property_id = p.id
  AND mr.organization_id IS NULL;

UPDATE maintenance_requests
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE insurance_policies ip
SET organization_id = COALESCE(p.organization_id, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'))
FROM properties p
WHERE ip.property_id = p.id
  AND ip.organization_id IS NULL;

UPDATE insurance_policies
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

UPDATE documents d
SET organization_id = u.organization_id
FROM users u
WHERE d.uploaded_by = u.id
  AND d.organization_id IS NULL;

UPDATE documents d
SET organization_id = p.organization_id
FROM properties p
WHERE d.organization_id IS NULL
  AND d.entity_type = 'property'
  AND d.entity_id = p.id;

UPDATE documents d
SET organization_id = t.organization_id
FROM tenants t
WHERE d.organization_id IS NULL
  AND d.entity_type = 'tenant'
  AND d.entity_id = t.id;

UPDATE documents d
SET organization_id = c.organization_id
FROM contracts c
WHERE d.organization_id IS NULL
  AND d.entity_type = 'contract'
  AND d.entity_id = c.id;

UPDATE documents
SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
WHERE organization_id IS NULL;

ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE buildings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contracts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE maintenance_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE insurance_policies ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE buildings ADD CONSTRAINT buildings_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE contracts ADD CONSTRAINT contracts_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT payments_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE expenses ADD CONSTRAINT expenses_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE maintenance_requests ADD CONSTRAINT maintenance_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE insurance_policies ADD CONSTRAINT insurance_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT documents_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_buildings_organization ON buildings(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_organization ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenants_organization ON tenants(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_organization ON contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_organization ON maintenance_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_insurance_organization ON insurance_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization ON documents(organization_id);