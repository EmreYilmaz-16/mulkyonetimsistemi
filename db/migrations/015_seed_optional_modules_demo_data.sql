DO $$
DECLARE
  org_id UUID;
BEGIN
  SELECT id INTO org_id
  FROM organizations
  WHERE slug = 'varsayilan-organizasyon';

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'varsayilan-organizasyon bulunamadi';
  END IF;

  INSERT INTO lawyers (id, organization_id, name, phone, email, specialty, bar_no, firm, hourly_rate, notes, is_active)
  VALUES
    ('c0000000-0000-0000-0000-000000000001', org_id, 'Av. Derya Akin', '05324440001', 'derya.akin@hukuk.local', 'gayrimenkul', '34-5120', 'Akin Hukuk Burosu', 3500.00, 'Kira tespit ve tahliye dosyalarinda uzman', TRUE),
    ('c0000000-0000-0000-0000-000000000002', org_id, 'Av. Murat Tunc', '05324440002', 'murat.tunc@hukuk.local', 'icra', '34-6188', 'Tunc & Ortaklari', 4200.00, 'Icra ve tahsilat takipleri icin calisiyor', TRUE)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    specialty = EXCLUDED.specialty,
    bar_no = EXCLUDED.bar_no,
    firm = EXCLUDED.firm,
    hourly_rate = EXCLUDED.hourly_rate,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  INSERT INTO legal_cases (
    id, organization_id, lawyer_id, property_id, tenant_id, case_type, title,
    court, case_no, status, filing_date, next_hearing, fee, description, result
  )
  VALUES
    ('c1000000-0000-0000-0000-000000000001', org_id, 'c0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'kira_tespit', 'A Blok Daire 3 kira tespit dosyasi', 'Istanbul Anadolu 4. Sulh Hukuk', '2025/412', 'devam_ediyor', DATE '2025-02-18', DATE '2026-06-14', 18500.00, 'Yeni donem kira uyarlama talebi', NULL),
    ('c1000000-0000-0000-0000-000000000002', org_id, 'c0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'icra', 'B Blok Ofis 2 gecikmis tahsilat takibi', 'Istanbul Anadolu 12. Icra', '2025/9912', 'bekleniyor', DATE '2025-03-05', DATE '2026-05-21', 9600.00, 'Subat gecikmesi icin icra takibi baslatildi', NULL),
    ('c1000000-0000-0000-0000-000000000003', org_id, 'c0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'tahliye', 'A Blok Daire 5 tahliye sureci', 'Istanbul Anadolu 2. Sulh Hukuk', '2024/188', 'sulh', DATE '2024-09-11', NULL, 7400.00, 'Bos teslim protokolu ile uzlasma saglandi', 'Kiraci 2024 Aralik sonunda tahliye etti')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    lawyer_id = EXCLUDED.lawyer_id,
    property_id = EXCLUDED.property_id,
    tenant_id = EXCLUDED.tenant_id,
    case_type = EXCLUDED.case_type,
    title = EXCLUDED.title,
    court = EXCLUDED.court,
    case_no = EXCLUDED.case_no,
    status = EXCLUDED.status,
    filing_date = EXCLUDED.filing_date,
    next_hearing = EXCLUDED.next_hearing,
    fee = EXCLUDED.fee,
    description = EXCLUDED.description,
    result = EXCLUDED.result,
    updated_at = NOW();

  INSERT INTO market_prices (
    id, organization_id, property_id, price_type, amount, source, url, noted_date, notes
  )
  VALUES
    ('c2000000-0000-0000-0000-000000000001', org_id, '30000000-0000-0000-0000-000000000001', 'rental', 31000.00, 'sahibinden', 'https://example.local/ilan/a-blok-daire-3-kiralik', DATE '2026-04-10', 'Benzer daireler icin kiralik emsal'),
    ('c2000000-0000-0000-0000-000000000002', org_id, '30000000-0000-0000-0000-000000000002', 'sale', 4250000.00, 'emlakjet', 'https://example.local/ilan/a-blok-daire-5-satilik', DATE '2026-04-11', 'Bos 3+1 daire satis emsali'),
    ('c2000000-0000-0000-0000-000000000003', org_id, '30000000-0000-0000-0000-000000000003', 'rental', 45000.00, 'manuel', NULL, DATE '2026-04-12', 'Yakindaki plaza ofislerinden toplanan teklif'),
    ('c2000000-0000-0000-0000-000000000004', org_id, '30000000-0000-0000-0000-000000000004', 'sale', 410000.00, 'sahibinden', 'https://example.local/ilan/kapali-otopark-14-satilik', DATE '2026-04-09', 'Otopark satis emsali')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    property_id = EXCLUDED.property_id,
    price_type = EXCLUDED.price_type,
    amount = EXCLUDED.amount,
    source = EXCLUDED.source,
    url = EXCLUDED.url,
    noted_date = EXCLUDED.noted_date,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO tax_declarations (
    id, organization_id, property_id, tax_type, year, month, amount, due_date, paid_date, status, reference_no, notes
  )
  VALUES
    ('c3000000-0000-0000-0000-000000000001', org_id, '30000000-0000-0000-0000-000000000001', 'gmsi', 2026, NULL, 18500.00, DATE '2026-03-31', DATE '2026-03-28', 'odendi', 'GMSI-2026-001', '2025 kira gelir beyani odendi'),
    ('c3000000-0000-0000-0000-000000000002', org_id, '30000000-0000-0000-0000-000000000003', 'stopaj', 2026, 4, 8400.00, DATE '2026-04-30', NULL, 'bekliyor', 'STP-2026-04', 'Nisan stopaj beyannamesi beklemede'),
    ('c3000000-0000-0000-0000-000000000003', org_id, '30000000-0000-0000-0000-000000000003', 'kdv', 2026, 4, 7560.00, DATE '2026-04-30', NULL, 'gecikti', 'KDV-2026-04', 'Nisan KDV odemesi gecikmede'),
    ('c3000000-0000-0000-0000-000000000004', org_id, '30000000-0000-0000-0000-000000000001', 'dask', 2026, NULL, 1850.00, DATE '2026-12-31', NULL, 'bekliyor', 'DASK-2026-001', 'Yil sonu yenileme takibi')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    property_id = EXCLUDED.property_id,
    tax_type = EXCLUDED.tax_type,
    year = EXCLUDED.year,
    month = EXCLUDED.month,
    amount = EXCLUDED.amount,
    due_date = EXCLUDED.due_date,
    paid_date = EXCLUDED.paid_date,
    status = EXCLUDED.status,
    reference_no = EXCLUDED.reference_no,
    notes = EXCLUDED.notes,
    updated_at = NOW();
END
$$;