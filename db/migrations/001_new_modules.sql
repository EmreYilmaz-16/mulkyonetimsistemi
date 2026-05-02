-- ============================================================
-- Migration 001: Avukat Takip, Fiyat Takibi, Vergi/Beyanname
-- ============================================================

-- ============================================================
-- LAWYERS (Avukatlar)
-- ============================================================
CREATE TABLE IF NOT EXISTS lawyers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(150) NOT NULL,
    phone       VARCHAR(20),
    email       VARCHAR(150),
    specialty   VARCHAR(100),
    bar_no      VARCHAR(50),
    firm        VARCHAR(200),
    hourly_rate NUMERIC(10,2),
    notes       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEGAL_CASES (Hukuki Davalar / İcra Takipleri)
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_cases (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lawyer_id    UUID REFERENCES lawyers(id) ON DELETE SET NULL,
    property_id  UUID REFERENCES properties(id) ON DELETE SET NULL,
    tenant_id    UUID REFERENCES tenants(id) ON DELETE SET NULL,
    case_type    VARCHAR(50) NOT NULL
                   CHECK (case_type IN ('tahliye','icra','kira_tespit','hasar','diger')),
    title        VARCHAR(200) NOT NULL,
    court        VARCHAR(200),
    case_no      VARCHAR(100),
    status       VARCHAR(30) NOT NULL DEFAULT 'devam_ediyor'
                   CHECK (status IN ('devam_ediyor','kazanildi','kaybedildi','sulh','bekleniyor')),
    filing_date  DATE,
    next_hearing DATE,
    fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
    description  TEXT,
    result       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MARKET_PRICES (Piyasa Fiyat Takibi - Kiralık / Satılık)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_prices (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id  UUID REFERENCES properties(id) ON DELETE SET NULL,
    price_type   VARCHAR(20) NOT NULL CHECK (price_type IN ('rental','sale')),
    amount       NUMERIC(14,2) NOT NULL,
    source       VARCHAR(200),
    url          VARCHAR(500),
    noted_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TAX_DECLARATIONS (Vergi / Beyanname / Sigorta Takibi)
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_declarations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id  UUID REFERENCES properties(id) ON DELETE SET NULL,
    tax_type     VARCHAR(50) NOT NULL
                   CHECK (tax_type IN (
                     'gmsi',
                     'emlak_1',
                     'emlak_2',
                     'dask',
                     'konut_sigorta',
                     'stopaj',
                     'kdv',
                     'diger'
                   )),
    year         INT NOT NULL,
    month        INT CHECK (month BETWEEN 1 AND 12),
    amount       NUMERIC(12,2),
    due_date     DATE,
    paid_date    DATE,
    status       VARCHAR(20) NOT NULL DEFAULT 'bekliyor'
                   CHECK (status IN ('bekliyor','odendi','gecikti','muaf')),
    reference_no VARCHAR(100),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_legal_cases_lawyer     ON legal_cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_property   ON legal_cases(property_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_status     ON legal_cases(status);
CREATE INDEX IF NOT EXISTS idx_market_prices_property ON market_prices(property_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_type     ON market_prices(price_type);
CREATE INDEX IF NOT EXISTS idx_tax_decl_property      ON tax_declarations(property_id);
CREATE INDEX IF NOT EXISTS idx_tax_decl_due_date      ON tax_declarations(due_date);
CREATE INDEX IF NOT EXISTS idx_tax_decl_status        ON tax_declarations(status);

-- ============================================================
-- UPDATED_AT TRIGGERS (yeni tablolar için)
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lawyers','legal_cases','market_prices','tax_declarations'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END;
$$;