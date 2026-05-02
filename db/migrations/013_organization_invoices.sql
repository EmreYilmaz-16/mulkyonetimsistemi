CREATE TABLE IF NOT EXISTS organization_invoices (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  invoice_number       VARCHAR(40) NOT NULL UNIQUE,
  subscription_plan    VARCHAR(30) NOT NULL
                         CHECK (subscription_plan IN ('starter','pro','enterprise')),
  amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency             VARCHAR(10) NOT NULL DEFAULT 'TRY',
  status               VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                         CHECK (status IN ('paid','unpaid','overdue')),
  billing_period_start DATE NOT NULL,
  billing_period_end   DATE NOT NULL,
  issued_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date             DATE NOT NULL,
  paid_at              TIMESTAMPTZ,
  note                 TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, billing_period_start, billing_period_end)
);

CREATE INDEX IF NOT EXISTS idx_org_invoices_organization_period
  ON organization_invoices(organization_id, billing_period_start DESC);

CREATE INDEX IF NOT EXISTS idx_org_invoices_status_due
  ON organization_invoices(status, due_date);

INSERT INTO organization_invoices (
  organization_id,
  invoice_number,
  subscription_plan,
  amount,
  currency,
  status,
  billing_period_start,
  billing_period_end,
  issued_at,
  due_date,
  note,
  metadata,
  created_at,
  updated_at
)
SELECT o.id,
       CONCAT('INV-', TO_CHAR(CURRENT_DATE, 'YYYYMM'), '-', UPPER(SUBSTRING(REPLACE(o.id::text, '-', '') FROM 1 FOR 6))),
       o.subscription_plan,
       CASE o.subscription_plan
         WHEN 'starter' THEN 1499
         WHEN 'pro' THEN 3999
         WHEN 'enterprise' THEN 9999
         ELSE 0
       END,
       'TRY',
       CASE
         WHEN COALESCE(o.trial_ends_at::date, (date_trunc('month', CURRENT_DATE) + INTERVAL '7 day')::date) < CURRENT_DATE THEN 'overdue'
         ELSE 'unpaid'
       END,
       date_trunc('month', CURRENT_DATE)::date,
       (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
       NOW(),
       COALESCE(o.trial_ends_at::date, (date_trunc('month', CURRENT_DATE) + INTERVAL '7 day')::date),
       'Bootstrap aylık abonelik faturası',
       jsonb_build_object(
         'source', 'migration',
         'max_users', o.max_users,
         'max_properties', o.max_properties,
         'trial_ends_at', o.trial_ends_at
       ),
       NOW(),
       NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_invoices i
  WHERE i.organization_id = o.id
    AND i.billing_period_start = date_trunc('month', CURRENT_DATE)::date
    AND i.billing_period_end = (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
);
