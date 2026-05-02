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
    specialty   VARCHAR(100),  -- 'gayrimenkul', 'icra', 'genel', 'diger'
    bar_no      VARCHAR(50),   -- Baro sicil no
    firm        VARCHAR(200),  -- Hukuk bürosu
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
    court        VARCHAR(200),   -- Mahkeme adı
    case_no      VARCHAR(100),   -- Esas no / İcra dosya no
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
    source       VARCHAR(200),  -- 'sahibinden', 'emlakjet', 'hurriyet', 'manuel'
    url          VARCHAR(500),
    noted_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TAX_DECLARATIONS (Vergi / Beyanname / Sigorta Takibi)
--
-- Türkiye'de mülk sahipleri için önemli tarihler:
--   GMSI (Gelir Vergisi - Kira): Beyanname Mart 1-31, 1.taksit Mart, 2.taksit Temmuz
--   Emlak Vergisi 1.taksit     : Mayıs 1-31
--   Emlak Vergisi 2.taksit     : Kasım 1-30
--   DASK                       : Poliçe bitiş tarihinde yenileme
--   Konut Sigortası            : Poliçe bitiş tarihinde yenileme
--   Stopaj (ticari)            : Her ay 23. günü beyanname, son günü ödeme
--   KDV (ticari)               : Her ay 24. günü beyanname, son günü ödeme
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_declarations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id  UUID REFERENCES properties(id) ON DELETE SET NULL,
    tax_type     VARCHAR(50) NOT NULL
                   CHECK (tax_type IN (
                     'gmsi',           -- Yıllık kira geliri (GMSI) beyannamesi
                     'emlak_1',        -- Emlak vergisi 1. taksit (Mayıs)
                     'emlak_2',        -- Emlak vergisi 2. taksit (Kasım)
                     'dask',           -- DASK yenileme
                     'konut_sigorta',  -- Konut sigortası yenileme
                     'stopaj',         -- Aylık stopaj (ticari kira)
                     'kdv',            -- Aylık KDV (ticari kira)
                     'diger'           -- Diğer
                   )),
    year         INT NOT NULL,
    month        INT CHECK (month BETWEEN 1 AND 12),  -- NULL = yıllık
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
-- UPDATED_AT TRİGGERS (yeni tablolar için)
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['lawyers','legal_cases','market_prices','tax_declarations'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
