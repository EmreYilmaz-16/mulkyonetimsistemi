CREATE TABLE IF NOT EXISTS organization_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id UUID,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_organization_created
  ON organization_audit_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_event_type
  ON organization_audit_logs(event_type);

INSERT INTO organization_audit_logs (
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
SELECT o.id,
       NULL,
       'organization_bootstrapped',
       'organization',
       o.id,
       o.name,
       CONCAT('Paket: ', o.subscription_plan, ' • Limitler: ', o.max_users, ' kullanici / ', o.max_properties, ' mulk'),
       jsonb_build_object(
         'subscription_plan', o.subscription_plan,
         'max_users', o.max_users,
         'max_properties', o.max_properties,
         'is_active', o.is_active
       ),
       o.created_at
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_audit_logs l
  WHERE l.organization_id = o.id
    AND l.event_type = 'organization_bootstrapped'
    AND l.entity_id = o.id
);

INSERT INTO organization_audit_logs (
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
SELECT u.organization_id,
       NULL,
       'user_created',
       'user',
       u.id,
       u.name,
       CONCAT('Kullanici eklendi: ', u.email),
       jsonb_build_object('role', u.role, 'email', u.email),
       u.created_at
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_audit_logs l
  WHERE l.event_type = 'user_created'
    AND l.entity_id = u.id
);

INSERT INTO organization_audit_logs (
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
SELECT p.organization_id,
       NULL,
       'property_created',
       'property',
       p.id,
       p.name,
       CONCAT('Mulk eklendi • Durum: ', p.status),
       jsonb_build_object('status', p.status, 'type', p.type),
       p.created_at
FROM properties p
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_audit_logs l
  WHERE l.event_type = 'property_created'
    AND l.entity_id = p.id
);

INSERT INTO organization_audit_logs (
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
SELECT c.organization_id,
       NULL,
       'contract_created',
       'contract',
       c.id,
       CONCAT('Sozlesme #', LEFT(c.id::text, 8)),
       CONCAT('Aylik kira: ', c.monthly_rent::text),
       jsonb_build_object('monthly_rent', c.monthly_rent, 'status', c.status),
       c.created_at
FROM contracts c
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_audit_logs l
  WHERE l.event_type = 'contract_created'
    AND l.entity_id = c.id
);

INSERT INTO organization_audit_logs (
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
SELECT p.organization_id,
       NULL,
       'payment_recorded',
       'payment',
       p.id,
       CONCAT('Odeme #', LEFT(p.id::text, 8)),
       CONCAT('Durum: ', p.status, ' • Tutar: ', p.amount::text),
       jsonb_build_object('status', p.status, 'amount', p.amount),
       COALESCE(p.payment_date::timestamp, p.created_at)
FROM payments p
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_audit_logs l
  WHERE l.event_type = 'payment_recorded'
    AND l.entity_id = p.id
);