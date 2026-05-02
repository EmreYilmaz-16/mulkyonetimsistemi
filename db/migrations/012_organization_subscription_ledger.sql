CREATE TABLE IF NOT EXISTS organization_subscription_ledger (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  related_request_id    UUID,
  event_type            VARCHAR(60) NOT NULL,
  status                VARCHAR(30) NOT NULL
                          CHECK (status IN ('trial','active','pending','approved','rejected','cancelled')),
  subscription_plan     VARCHAR(30) NOT NULL
                          CHECK (subscription_plan IN ('starter','pro','enterprise')),
  amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(10) NOT NULL DEFAULT 'TRY',
  billing_period_months INT NOT NULL DEFAULT 1,
  effective_at          TIMESTAMPTZ,
  renewal_at            TIMESTAMPTZ,
  note                  TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subscription_ledger_org_created
  ON organization_subscription_ledger(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_subscription_ledger_status
  ON organization_subscription_ledger(status);

CREATE INDEX IF NOT EXISTS idx_org_subscription_ledger_event_type
  ON organization_subscription_ledger(event_type);

INSERT INTO organization_subscription_ledger (
  organization_id,
  event_type,
  status,
  subscription_plan,
  amount,
  currency,
  billing_period_months,
  effective_at,
  renewal_at,
  note,
  metadata,
  created_at
)
SELECT o.id,
       'subscription_bootstrapped',
       CASE WHEN o.trial_ends_at IS NOT NULL AND o.trial_ends_at >= NOW() THEN 'trial' ELSE 'active' END,
       o.subscription_plan,
       CASE o.subscription_plan
         WHEN 'starter' THEN 1499
         WHEN 'pro' THEN 3999
         WHEN 'enterprise' THEN 9999
         ELSE 0
       END,
       'TRY',
       1,
       o.created_at,
       COALESCE(o.trial_ends_at, o.created_at + INTERVAL '1 month'),
       'Bootstrap abonelik kaydı',
       jsonb_build_object(
         'source', 'migration',
         'trial_ends_at', o.trial_ends_at,
         'max_users', o.max_users,
         'max_properties', o.max_properties
       ),
       o.created_at
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_subscription_ledger l
  WHERE l.organization_id = o.id
);