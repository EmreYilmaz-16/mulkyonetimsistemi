-- ============================================================
-- Repair documents table for multi-tenant foundation
-- ============================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE documents d
SET organization_id = u.organization_id
FROM users u
WHERE d.organization_id IS NULL
  AND d.uploaded_by = u.id;

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

ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;