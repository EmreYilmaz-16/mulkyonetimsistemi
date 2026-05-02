DO $$
DECLARE
  org_id UUID;
  admin_user_id UUID;
BEGIN
  SELECT id INTO org_id
  FROM organizations
  WHERE slug = 'varsayilan-organizasyon';

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'varsayilan-organizasyon bulunamadi';
  END IF;

  SELECT id INTO admin_user_id
  FROM users
  WHERE email = 'admin@kiratakip.local';

  INSERT INTO users (id, organization_id, name, email, password, role, phone, is_active)
  VALUES
    ('10000000-0000-0000-0000-000000000001', org_id, 'Ayse Yonetici', 'ayse@demokira.local', '$2a$12$AQYte6kA1j/h60TNRuvk7.KizR7jB5l5HP2/qNNjLonH80885kxN6', 'owner', '05320000001', TRUE),
    ('10000000-0000-0000-0000-000000000002', org_id, 'Mehmet Muhasebe', 'muhasebe@demokira.local', '$2a$12$AQYte6kA1j/h60TNRuvk7.KizR7jB5l5HP2/qNNjLonH80885kxN6', 'accountant', '05320000002', TRUE),
    ('10000000-0000-0000-0000-000000000003', org_id, 'Selin Portfoy', 'selin@demokira.local', '$2a$12$AQYte6kA1j/h60TNRuvk7.KizR7jB5l5HP2/qNNjLonH80885kxN6', 'agent', '05320000003', TRUE)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  INSERT INTO buildings (id, organization_id, name, address, city, district, total_floors, total_units, notes)
  VALUES
    ('20000000-0000-0000-0000-000000000001', org_id, 'Gunes Apartmani', 'Ataturk Mah. 101. Sok. No:12', 'Istanbul', 'Kadikoy', 8, 16, 'Merkezi lokasyon, aile profili agirlikli'),
    ('20000000-0000-0000-0000-000000000002', org_id, 'Deniz Residence', 'Sahil Cad. No:28', 'Istanbul', 'Maltepe', 12, 24, 'Kapali otopark ve guvenlik mevcut')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    total_floors = EXCLUDED.total_floors,
    total_units = EXCLUDED.total_units,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO properties (id, organization_id, building_id, name, site_name, type, floor, unit_number, area_sqm, deed_info, description, status, purchase_price, market_value)
  VALUES
    ('30000000-0000-0000-0000-000000000001', org_id, '20000000-0000-0000-0000-000000000001', 'A Blok Daire 3', 'Gunes Apartmani', 'residential', 3, '3', 95.00, 'Mesken tapulu', 'Kiracili 2+1 daire', 'rented', 2450000.00, 3650000.00),
    ('30000000-0000-0000-0000-000000000002', org_id, '20000000-0000-0000-0000-000000000001', 'A Blok Daire 5', 'Gunes Apartmani', 'residential', 5, '5', 110.00, 'Mesken tapulu', 'Bos 3+1 daire', 'available', 2680000.00, 4025000.00),
    ('30000000-0000-0000-0000-000000000003', org_id, '20000000-0000-0000-0000-000000000002', 'B Blok Ofis 2', 'Deniz Residence', 'commercial', 2, 'OF-2', 140.00, 'Is yeri tapulu', 'Kurumsal kiracili ofis', 'rented', 3150000.00, 4875000.00),
    ('30000000-0000-0000-0000-000000000004', org_id, '20000000-0000-0000-0000-000000000002', 'Kapali Otopark 14', 'Deniz Residence', 'parking', -1, 'P-14', 18.00, 'Eklenti alan', 'Aylik kiraya uygun park alani', 'available', 220000.00, 390000.00)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    building_id = EXCLUDED.building_id,
    name = EXCLUDED.name,
    site_name = EXCLUDED.site_name,
    type = EXCLUDED.type,
    floor = EXCLUDED.floor,
    unit_number = EXCLUDED.unit_number,
    area_sqm = EXCLUDED.area_sqm,
    deed_info = EXCLUDED.deed_info,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    purchase_price = EXCLUDED.purchase_price,
    market_value = EXCLUDED.market_value,
    updated_at = NOW();

  INSERT INTO tenants (id, organization_id, first_name, last_name, tc_no, phone, email, emergency_contact, emergency_phone, findeks_score, notes, is_active)
  VALUES
    ('40000000-0000-0000-0000-000000000001', org_id, 'Ali', 'Yilmaz', '12345678901', '05330000001', 'ali.yilmaz@example.com', 'Fatma Yilmaz', '05330000011', 1520, 'Odemeleri duzenli', TRUE),
    ('40000000-0000-0000-0000-000000000002', org_id, 'Zeynep', 'Kara', '12345678902', '05330000002', 'zeynep.kara@example.com', 'Murat Kara', '05330000012', 1480, '1 evcil hayvan bilgisi mevcut', TRUE),
    ('40000000-0000-0000-0000-000000000003', org_id, 'Burak', 'Demir', '12345678903', '05330000003', 'burak.demir@example.com', 'Aylin Demir', '05330000013', 1390, 'Ticari ofis kiracisi', TRUE),
    ('40000000-0000-0000-0000-000000000004', org_id, 'Elif', 'Sahin', '12345678904', '05330000004', 'elif.sahin@example.com', 'Hakan Sahin', '05330000014', 1455, 'Yeni portfoy adayi', TRUE)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    tc_no = EXCLUDED.tc_no,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    emergency_contact = EXCLUDED.emergency_contact,
    emergency_phone = EXCLUDED.emergency_phone,
    findeks_score = EXCLUDED.findeks_score,
    notes = EXCLUDED.notes,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  INSERT INTO contracts (id, organization_id, property_id, tenant_id, start_date, end_date, monthly_rent, deposit_amount, increase_type, increase_rate, special_terms, eviction_date, status)
  VALUES
    ('50000000-0000-0000-0000-000000000001', org_id, '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', DATE '2025-01-01', DATE '2025-12-31', 28500.00, 57000.00, 'tüfe', 18.00, 'Aidat kiraciya aittir', NULL, 'active'),
    ('50000000-0000-0000-0000-000000000002', org_id, '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', DATE '2024-10-01', DATE '2026-09-30', 42000.00, 84000.00, 'sabit', 12.00, 'Stopaj kiraciya aittir', NULL, 'active'),
    ('50000000-0000-0000-0000-000000000003', org_id, '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', DATE '2024-01-01', DATE '2024-12-31', 24000.00, 48000.00, 'anlaşma', NULL, 'Kontrat yenilenmeyecek', DATE '2024-12-31', 'expired')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    property_id = EXCLUDED.property_id,
    tenant_id = EXCLUDED.tenant_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    monthly_rent = EXCLUDED.monthly_rent,
    deposit_amount = EXCLUDED.deposit_amount,
    increase_type = EXCLUDED.increase_type,
    increase_rate = EXCLUDED.increase_rate,
    special_terms = EXCLUDED.special_terms,
    eviction_date = EXCLUDED.eviction_date,
    status = EXCLUDED.status,
    updated_at = NOW();

  INSERT INTO payments (id, organization_id, contract_id, amount, due_date, payment_date, status, method, reference_no, notes)
  VALUES
    ('60000000-0000-0000-0000-000000000001', org_id, '50000000-0000-0000-0000-000000000001', 28500.00, DATE '2025-01-05', DATE '2025-01-03', 'paid', 'bank_transfer', 'TRX-202501-001', 'Ocak odemesi zamaninda alindi'),
    ('60000000-0000-0000-0000-000000000002', org_id, '50000000-0000-0000-0000-000000000001', 28500.00, DATE '2025-02-05', DATE '2025-02-06', 'paid', 'eft', 'TRX-202502-001', '1 gun gecikmeli odeme'),
    ('60000000-0000-0000-0000-000000000003', org_id, '50000000-0000-0000-0000-000000000001', 28500.00, DATE '2025-03-05', NULL, 'pending', NULL, NULL, 'Mart odemesi bekleniyor'),
    ('60000000-0000-0000-0000-000000000004', org_id, '50000000-0000-0000-0000-000000000002', 42000.00, DATE '2025-01-01', DATE '2024-12-30', 'paid', 'bank_transfer', 'TRX-202501-OFIS', 'Ofis kira odemesi'),
    ('60000000-0000-0000-0000-000000000005', org_id, '50000000-0000-0000-0000-000000000002', 42000.00, DATE '2025-02-01', NULL, 'late', NULL, NULL, 'Gecikmede olan odeme'),
    ('60000000-0000-0000-0000-000000000006', org_id, '50000000-0000-0000-0000-000000000003', 24000.00, DATE '2024-11-01', DATE '2024-11-01', 'paid', 'cash', 'TRX-202411-ESKI', 'Suresi dolmus kontratin son odemesi')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    contract_id = EXCLUDED.contract_id,
    amount = EXCLUDED.amount,
    due_date = EXCLUDED.due_date,
    payment_date = EXCLUDED.payment_date,
    status = EXCLUDED.status,
    method = EXCLUDED.method,
    reference_no = EXCLUDED.reference_no,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO expenses (id, organization_id, property_id, category, amount, date, vendor, description, receipt_url)
  VALUES
    ('70000000-0000-0000-0000-000000000001', org_id, '30000000-0000-0000-0000-000000000001', 'maintenance', 3500.00, DATE '2025-01-12', 'Usta Tesisat', 'Banyo gider acma ve sifon degisimi', 'https://example.local/receipts/exp-001.pdf'),
    ('70000000-0000-0000-0000-000000000002', org_id, '30000000-0000-0000-0000-000000000003', 'tax', 9800.00, DATE '2025-01-20', 'Istanbul Vergi Dairesi', 'Yillik cevre temizlik vergisi', 'https://example.local/receipts/exp-002.pdf'),
    ('70000000-0000-0000-0000-000000000003', org_id, '30000000-0000-0000-0000-000000000002', 'renovation', 18500.00, DATE '2025-02-15', 'Dekor Yapim', 'Bos daire boya ve mutfak yenileme', 'https://example.local/receipts/exp-003.pdf')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    property_id = EXCLUDED.property_id,
    category = EXCLUDED.category,
    amount = EXCLUDED.amount,
    date = EXCLUDED.date,
    vendor = EXCLUDED.vendor,
    description = EXCLUDED.description,
    receipt_url = EXCLUDED.receipt_url,
    updated_at = NOW();

  INSERT INTO maintenance_requests (id, organization_id, property_id, tenant_id, title, description, priority, status, assigned_to, cost, completed_at)
  VALUES
    ('80000000-0000-0000-0000-000000000001', org_id, '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Mutfak bataryasi sizdiriyor', 'Evye altinda su kacagi tespit edildi', 'high', 'completed', 'Usta Tesisat', 3500.00, TIMESTAMPTZ '2025-01-12 14:30:00+03'),
    ('80000000-0000-0000-0000-000000000002', org_id, '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Klima bakimi', 'Yillik periyodik klima bakimi talebi', 'normal', 'in_progress', 'Teknik Servis 34', 2200.00, NULL),
    ('80000000-0000-0000-0000-000000000003', org_id, '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Boya badana kesfi', 'Yeni kiralama oncesi ekspertiz ve boya plani', 'low', 'open', 'Selin Portfoy', NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    property_id = EXCLUDED.property_id,
    tenant_id = EXCLUDED.tenant_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    assigned_to = EXCLUDED.assigned_to,
    cost = EXCLUDED.cost,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW();

  INSERT INTO insurance_policies (id, organization_id, property_id, type, company, policy_no, start_date, end_date, premium, notes)
  VALUES
    ('90000000-0000-0000-0000-000000000001', org_id, '30000000-0000-0000-0000-000000000001', 'dask', 'Anadolu Sigorta', 'DASK-2025-0001', DATE '2025-01-01', DATE '2025-12-31', 1850.00, 'Yillik zorunlu deprem sigortasi'),
    ('90000000-0000-0000-0000-000000000002', org_id, '30000000-0000-0000-0000-000000000003', 'konut', 'Axa Sigorta', 'KNUT-2025-0044', DATE '2025-02-01', DATE '2026-01-31', 4250.00, 'Ofis icin kapsamli paket police')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    property_id = EXCLUDED.property_id,
    type = EXCLUDED.type,
    company = EXCLUDED.company,
    policy_no = EXCLUDED.policy_no,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    premium = EXCLUDED.premium,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO documents (id, organization_id, entity_type, entity_id, file_name, original_name, mime_type, file_size, uploaded_by)
  VALUES
    ('a0000000-0000-0000-0000-000000000001', org_id, 'property', '30000000-0000-0000-0000-000000000001', 'ekspertiz-a3.pdf', 'ekspertiz-raporu.pdf', 'application/pdf', 248320, COALESCE(admin_user_id, '10000000-0000-0000-0000-000000000001')),
    ('a0000000-0000-0000-0000-000000000002', org_id, 'tenant', '40000000-0000-0000-0000-000000000001', 'kimlik-ali.jpg', 'ali-yilmaz-kimlik.jpg', 'image/jpeg', 182451, COALESCE(admin_user_id, '10000000-0000-0000-0000-000000000001')),
    ('a0000000-0000-0000-0000-000000000003', org_id, 'contract', '50000000-0000-0000-0000-000000000002', 'ofis-kontrat.pdf', 'deniz-residence-ofis-kontrat.pdf', 'application/pdf', 512004, COALESCE(admin_user_id, '10000000-0000-0000-0000-000000000001'))
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    entity_type = EXCLUDED.entity_type,
    entity_id = EXCLUDED.entity_id,
    file_name = EXCLUDED.file_name,
    original_name = EXCLUDED.original_name,
    mime_type = EXCLUDED.mime_type,
    file_size = EXCLUDED.file_size,
    uploaded_by = EXCLUDED.uploaded_by,
    updated_at = NOW();
END
$$;

INSERT INTO organization_audit_logs (
  id,
  organization_id,
  actor_user_id,
  event_type,
  entity_type,
  entity_id,
  title,
  description,
  metadata,
  created_at
)
SELECT *
FROM (
  VALUES
    ('b0000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'), NULL::uuid, 'demo_seed_loaded', 'organization', (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'), 'Demo veri yuklendi', 'Mulk yonetim testi icin ornek kayitlar olusturuldu', jsonb_build_object('seed', '014_seed_demo_data'), NOW()),
    ('b0000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'), NULL::uuid, 'property_created', 'property', '30000000-0000-0000-0000-000000000001'::uuid, 'A Blok Daire 3', 'Demo seed ile property olusturuldu', jsonb_build_object('status', 'rented', 'type', 'residential'), NOW()),
    ('b0000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM organizations WHERE slug = 'varsayilan-organizasyon'), NULL::uuid, 'contract_created', 'contract', '50000000-0000-0000-0000-000000000001'::uuid, 'Sozlesme demo kaydi', 'Demo seed ile aktif sozlesme olusturuldu', jsonb_build_object('monthly_rent', 28500, 'status', 'active'), NOW())
) AS seed_rows(id, organization_id, actor_user_id, event_type, entity_type, entity_id, title, description, metadata, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM organization_audit_logs l WHERE l.id = seed_rows.id
);