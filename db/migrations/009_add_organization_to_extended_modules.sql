DO $$
BEGIN
  IF to_regclass('public.lawyers') IS NOT NULL THEN
    ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS organization_id UUID;

    UPDATE lawyers
    SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    WHERE organization_id IS NULL;

    ALTER TABLE lawyers ALTER COLUMN organization_id SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lawyers_organization_fk') THEN
      ALTER TABLE lawyers ADD CONSTRAINT lawyers_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_lawyers_organization ON lawyers(organization_id);
  END IF;

  IF to_regclass('public.legal_cases') IS NOT NULL THEN
    ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS organization_id UUID;

    UPDATE legal_cases lc
    SET organization_id = COALESCE(
      (SELECT l.organization_id FROM lawyers l WHERE l.id = lc.lawyer_id),
      (SELECT p.organization_id FROM properties p WHERE p.id = lc.property_id),
      (SELECT t.organization_id FROM tenants t WHERE t.id = lc.tenant_id),
      (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    )
    WHERE lc.organization_id IS NULL;

    UPDATE legal_cases
    SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    WHERE organization_id IS NULL;

    ALTER TABLE legal_cases ALTER COLUMN organization_id SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_cases_organization_fk') THEN
      ALTER TABLE legal_cases ADD CONSTRAINT legal_cases_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_legal_cases_organization ON legal_cases(organization_id);
  END IF;

  IF to_regclass('public.market_prices') IS NOT NULL THEN
    ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS organization_id UUID;

    UPDATE market_prices mp
    SET organization_id = COALESCE(
      p.organization_id,
      (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    )
    FROM properties p
    WHERE mp.organization_id IS NULL
      AND p.id = mp.property_id;

    UPDATE market_prices
    SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    WHERE organization_id IS NULL;

    ALTER TABLE market_prices ALTER COLUMN organization_id SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_prices_organization_fk') THEN
      ALTER TABLE market_prices ADD CONSTRAINT market_prices_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_market_prices_organization ON market_prices(organization_id);
  END IF;

  IF to_regclass('public.tax_declarations') IS NOT NULL THEN
    ALTER TABLE tax_declarations ADD COLUMN IF NOT EXISTS organization_id UUID;

    UPDATE tax_declarations td
    SET organization_id = COALESCE(
      p.organization_id,
      (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    )
    FROM properties p
    WHERE td.organization_id IS NULL
      AND p.id = td.property_id;

    UPDATE tax_declarations
    SET organization_id = (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon')
    WHERE organization_id IS NULL;

    ALTER TABLE tax_declarations ALTER COLUMN organization_id SET NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_declarations_organization_fk') THEN
      ALTER TABLE tax_declarations ADD CONSTRAINT tax_declarations_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_tax_decl_organization ON tax_declarations(organization_id);
  END IF;
END
$$;