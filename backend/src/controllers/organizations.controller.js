const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { AUDIT_EVENT_TYPES, AUDIT_EVENT_LABELS, AUDIT_EVENT_TYPE_SET } = require('../utils/organizationAudit');
const {
  createAppError,
  slugifyOrganizationName,
  getPlanDefaults,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const VALID_PLANS = ['starter', 'pro', 'enterprise'];
const PLAN_PRICES = {
  starter: 1499,
  pro: 3999,
  enterprise: 9999
};

const getPlanPrice = (plan) => PLAN_PRICES[plan] || 0;

const buildRenewalAt = (trialEndsAt, fallbackDate = new Date()) => {
  if (trialEndsAt) {
    return trialEndsAt;
  }

  const baseDate = new Date(fallbackDate);
  baseDate.setMonth(baseDate.getMonth() + 1);
  return baseDate.toISOString();
};

const recordSubscriptionLedgerEntry = async ({
  organizationId,
  actorUserId = null,
  relatedRequestId = null,
  eventType,
  status,
  subscriptionPlan,
  effectiveAt = null,
  renewalAt = null,
  note = null,
  metadata = {},
  createdAt = null,
  db = query
}) => {
  await db(
    `INSERT INTO organization_subscription_ledger (
      organization_id,
      actor_user_id,
      related_request_id,
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
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'TRY',1,$8,$9,$10,$11,$12)`,
    [
      organizationId,
      actorUserId,
      relatedRequestId,
      eventType,
      status,
      subscriptionPlan,
      getPlanPrice(subscriptionPlan),
      effectiveAt,
      renewalAt,
      note,
      metadata,
      createdAt || new Date().toISOString()
    ]
  );
};

const getCurrentBillingPeriod = (referenceDate = new Date()) => {
  const baseDate = new Date(referenceDate);
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1));
  const periodEnd = new Date(Date.UTC(year, month + 1, 0));

  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    periodKey: `${year}${String(month + 1).padStart(2, '0')}`
  };
};

const buildInvoiceDueDate = (trialEndsAt, referenceDate = new Date()) => {
  if (trialEndsAt) {
    return new Date(trialEndsAt).toISOString().slice(0, 10);
  }

  const current = new Date(referenceDate);
  const dueDate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 8));
  return dueDate.toISOString().slice(0, 10);
};

const normalizeInvoiceStatus = (status, dueDate) => {
  if (status === 'paid') {
    return 'paid';
  }

  if (status === 'overdue') {
    return 'overdue';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  return due < today ? 'overdue' : 'unpaid';
};

const syncOverdueInvoices = async (db = query) => {
  await db(
    `UPDATE organization_invoices
        SET status = 'overdue',
            updated_at = NOW()
      WHERE status = 'unpaid'
        AND due_date < CURRENT_DATE`
  );
};

const upsertOrganizationInvoice = async ({
  organizationId,
  actorUserId = null,
  subscriptionPlan,
  trialEndsAt = null,
  issuedAt = new Date().toISOString(),
  note = null,
  metadata = {},
  db = query
}) => {
  const { periodStart, periodEnd, periodKey } = getCurrentBillingPeriod(issuedAt);
  const dueDate = buildInvoiceDueDate(trialEndsAt, issuedAt);
  const amount = getPlanPrice(subscriptionPlan);
  const existingResult = await db(
    `SELECT id, invoice_number, status
       FROM organization_invoices
      WHERE organization_id = $1
        AND billing_period_start = $2
        AND billing_period_end = $3
      LIMIT 1`,
    [organizationId, periodStart, periodEnd]
  );

  if (existingResult.rows.length) {
    const existingInvoice = existingResult.rows[0];
    const nextStatus = existingInvoice.status === 'paid'
      ? 'paid'
      : normalizeInvoiceStatus(existingInvoice.status, dueDate);

    const updateResult = await db(
      `UPDATE organization_invoices
          SET actor_user_id = $1,
              subscription_plan = $2,
              amount = $3,
              due_date = $4,
              status = $5,
              note = $6,
              metadata = COALESCE(metadata, '{}'::jsonb) || $7::jsonb,
              updated_at = NOW()
        WHERE id = $8
        RETURNING *`,
      [
        actorUserId,
        subscriptionPlan,
        amount,
        dueDate,
        nextStatus,
        note,
        JSON.stringify(metadata || {}),
        existingInvoice.id
      ]
    );

    return updateResult.rows[0];
  }

  const invoiceNumber = `INV-${periodKey}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const createdAt = issuedAt || new Date().toISOString();
  const insertResult = await db(
    `INSERT INTO organization_invoices (
      organization_id,
      actor_user_id,
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
    ) VALUES ($1,$2,$3,$4,$5,'TRY',$6,$7,$8,$9,$10,$11,$12,$13,$13)
    RETURNING *`,
    [
      organizationId,
      actorUserId,
      invoiceNumber,
      subscriptionPlan,
      amount,
      normalizeInvoiceStatus('unpaid', dueDate),
      periodStart,
      periodEnd,
      createdAt,
      dueDate,
      note,
      JSON.stringify(metadata || {}),
      createdAt
    ]
  );

  await recordOrganizationAuditEvent({
    organizationId,
    actorUserId,
    eventType: AUDIT_EVENT_TYPES.INVOICE_CREATED,
    entityType: 'invoice',
    entityId: insertResult.rows[0].id,
    title: insertResult.rows[0].invoice_number,
    description: `Aylık paket faturası oluşturuldu: ${subscriptionPlan} • ₺${Number(amount).toLocaleString('tr-TR')}`,
    metadata: {
      invoice_number: insertResult.rows[0].invoice_number,
      subscription_plan: subscriptionPlan,
      amount,
      due_date: dueDate,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      ...metadata
    },
    occurredAt: createdAt,
    db
  });

  return insertResult.rows[0];
};

const ORGANIZATION_USAGE_TABLES = [
  { key: 'users', table: 'users' },
  { key: 'buildings', table: 'buildings' },
  { key: 'properties', table: 'properties' },
  { key: 'tenants', table: 'tenants' },
  { key: 'contracts', table: 'contracts' },
  { key: 'payments', table: 'payments' },
  { key: 'expenses', table: 'expenses' },
  { key: 'maintenance_requests', table: 'maintenance_requests' },
  { key: 'documents', table: 'documents' },
  { key: 'lawyers', table: 'lawyers' },
  { key: 'legal_cases', table: 'legal_cases' },
  { key: 'market_prices', table: 'market_prices' },
  { key: 'tax_declarations', table: 'tax_declarations' }
];

const BACKFILL_EVENT_TYPES = new Set([
  AUDIT_EVENT_TYPES.ORGANIZATION_BOOTSTRAPPED,
  AUDIT_EVENT_TYPES.USER_CREATED,
  AUDIT_EVENT_TYPES.PROPERTY_CREATED,
  AUDIT_EVENT_TYPES.CONTRACT_CREATED,
  AUDIT_EVENT_TYPES.PAYMENT_RECORDED
]);

const withAuditOrigin = (row) => {
  const metadata = row.metadata || {};
  const isBackfill = metadata.source === 'backfill'
    || (!row.actor_user_id && BACKFILL_EVENT_TYPES.has(row.event_type || row.type));
  const originType = row.actor_user_id ? 'user' : (isBackfill ? 'backfill' : 'system');
  const originLabel = originType === 'user' ? 'Kullanıcı' : originType === 'backfill' ? 'Backfill' : 'Sistem';

  return {
    ...row,
    origin_type: originType,
    origin_label: originLabel
  };
};

const normalizeAdminPayload = (payload, { partial = false } = {}) => {
  const admin = {};

  if (!partial || payload.admin_name !== undefined) {
    const adminName = payload.admin_name?.trim();
    if (!partial && !adminName) {
      throw createAppError('İlk admin adı zorunlu', 400);
    }
    if (adminName) admin.name = adminName;
  }

  if (!partial || payload.admin_email !== undefined) {
    const adminEmail = payload.admin_email?.trim().toLowerCase();
    if (!partial && !adminEmail) {
      throw createAppError('İlk admin e-postası zorunlu', 400);
    }
    if (adminEmail) admin.email = adminEmail;
  }

  if (!partial || payload.admin_password !== undefined) {
    const adminPassword = payload.admin_password || '';
    if (!partial && adminPassword.length < 8) {
      throw createAppError('İlk admin şifresi en az 8 karakter olmalı', 400);
    }
    if (adminPassword) admin.password = adminPassword;
  }

  if (payload.admin_phone !== undefined) {
    admin.phone = payload.admin_phone?.trim() || null;
  }

  return admin;
};

const getOrganizationUsage = async (organizationId, db = query) => {
  const usage = {};

  for (const config of ORGANIZATION_USAGE_TABLES) {
    const sql = config.key === 'users'
      ? `SELECT COUNT(*)::int AS total FROM ${config.table} WHERE organization_id = $1 AND role <> 'platform_admin'`
      : `SELECT COUNT(*)::int AS total FROM ${config.table} WHERE organization_id = $1`;

    const { rows } = await db(sql, [organizationId]);
    usage[config.key] = rows[0].total;
  }

  return usage;
};

const getOrganizationUsageHistory = async (organizationId, db = query) => {
  const { rows } = await db(
    `WITH months AS (
       SELECT date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * gs.n) AS month_start
       FROM generate_series(5, 0, -1) AS gs(n)
     )
     SELECT month_start::date,
            COUNT(*) FILTER (WHERE l.event_type = 'user_created')::int AS users_added,
            COUNT(*) FILTER (WHERE l.event_type = 'property_created')::int AS properties_added,
            COUNT(*) FILTER (WHERE l.event_type = 'contract_created')::int AS contracts_started,
            COUNT(*) FILTER (WHERE l.event_type = 'payment_recorded')::int AS payments_created,
            COALESCE(SUM(
              CASE WHEN l.event_type IN ('payment_recorded', 'payment_marked_paid')
                THEN NULLIF(l.metadata->>'amount', '')::numeric
                ELSE 0
              END
            ), 0)::numeric(12,2) AS paid_amount_total
     FROM months
     LEFT JOIN organization_audit_logs l
       ON l.organization_id = $1
      AND l.created_at >= month_start
      AND l.created_at < month_start + INTERVAL '1 month'
     GROUP BY month_start
     ORDER BY month_start DESC`,
    [organizationId]
  );

  return rows;
};

const getOrganizationRecentActivity = async (organizationId, db = query) => {
  const { rows } = await db(
    `SELECT organization_audit_logs.id,
       organization_audit_logs.event_type AS type,
       organization_audit_logs.entity_type,
       organization_audit_logs.entity_id AS id_ref,
       organization_audit_logs.actor_user_id,
       u.name AS actor_name,
       u.email AS actor_email,
       organization_audit_logs.title,
       organization_audit_logs.description,
       organization_audit_logs.metadata,
       organization_audit_logs.created_at AS occurred_at
     FROM organization_audit_logs
     LEFT JOIN users u ON u.id = organization_audit_logs.actor_user_id
     WHERE organization_audit_logs.organization_id = $1
     ORDER BY organization_audit_logs.created_at DESC
     LIMIT 10`,
    [organizationId]
  );

  return rows.map((row) => ({
    ...withAuditOrigin(row),
    event_label: AUDIT_EVENT_LABELS[row.type] || row.type
  }));
};

const getOrganizationAuditLog = async (organizationId, filters = {}, db = query) => {
  const {
    event_type,
    entity_type,
    from_date,
    to_date,
    page = 1,
    limit = 20
  } = filters;

  const conditions = ['organization_audit_logs.organization_id = $1'];
  const params = [organizationId];
  let index = 2;

  if (event_type) {
    conditions.push(`organization_audit_logs.event_type = $${index++}`);
    params.push(event_type);
  }

  if (entity_type) {
    conditions.push(`organization_audit_logs.entity_type = $${index++}`);
    params.push(entity_type);
  }

  if (from_date) {
    conditions.push(`organization_audit_logs.created_at >= $${index++}::timestamptz`);
    params.push(from_date);
  }

  if (to_date) {
    conditions.push(`organization_audit_logs.created_at <= $${index++}::timestamptz`);
    params.push(to_date);
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  if (event_type && !AUDIT_EVENT_TYPE_SET.has(event_type)) {
    throw createAppError('Gecersiz audit event tipi', 400);
  }

  const offset = (safePage - 1) * safeLimit;
  const where = `WHERE ${conditions.join(' AND ')}`;
  const countResult = await db(`SELECT COUNT(*)::int AS total FROM organization_audit_logs ${where}`, params);
  const summaryResult = await db(
        `SELECT COUNT(*)::int AS total,
          COUNT(DISTINCT organization_audit_logs.event_type)::int AS event_type_count,
          COUNT(DISTINCT organization_audit_logs.entity_type)::int AS entity_type_count,
          MAX(organization_audit_logs.created_at) AS last_event_at
     FROM organization_audit_logs
     ${where}`,
    params
  );
  const { rows } = await db(
        `SELECT organization_audit_logs.id,
          organization_audit_logs.event_type,
          organization_audit_logs.entity_type,
          organization_audit_logs.entity_id,
          organization_audit_logs.actor_user_id,
         u.name AS actor_name,
         u.email AS actor_email,
          organization_audit_logs.title,
          organization_audit_logs.description,
          organization_audit_logs.metadata,
          organization_audit_logs.created_at
     FROM organization_audit_logs
       LEFT JOIN users u ON u.id = organization_audit_logs.actor_user_id
     ${where}
         ORDER BY organization_audit_logs.created_at DESC
     LIMIT $${index++} OFFSET $${index++}`,
    [...params, safeLimit, offset]
  );

  return {
    rows: rows.map((row) => ({
      ...withAuditOrigin(row),
      event_label: AUDIT_EVENT_LABELS[row.event_type] || row.event_type
    })),
    meta: {
      total: countResult.rows[0].total,
      page: safePage,
      limit: safeLimit,
      total_pages: Math.max(Math.ceil(countResult.rows[0].total / safeLimit), 1)
    },
    summary: summaryResult.rows[0]
  };
};

const getOrganizationPlanRequests = async ({ limit = 10 } = {}, db = query) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const { rows } = await db(
    `SELECT organization_audit_logs.id,
            organization_audit_logs.organization_id,
            o.name AS organization_name,
            o.slug AS organization_slug,
            organization_audit_logs.actor_user_id,
            u.name AS actor_name,
            u.email AS actor_email,
            organization_audit_logs.title,
            organization_audit_logs.description,
            organization_audit_logs.metadata,
            organization_audit_logs.created_at,
            organization_audit_logs.event_type,
            decision.event_type AS decision_event_type,
            decision.created_at AS decision_created_at,
            decision.metadata->>'decision_note' AS decision_note,
            decision_actor.name AS decision_actor_name,
            decision_actor.email AS decision_actor_email
       FROM organization_audit_logs
       JOIN organizations o ON o.id = organization_audit_logs.organization_id
       LEFT JOIN users u ON u.id = organization_audit_logs.actor_user_id
       LEFT JOIN LATERAL (
         SELECT l2.*
         FROM organization_audit_logs l2
         WHERE l2.organization_id = organization_audit_logs.organization_id
           AND l2.event_type IN ('${AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_APPROVED}', '${AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REJECTED}')
           AND l2.metadata->>'request_id' = organization_audit_logs.id::text
         ORDER BY l2.created_at DESC
         LIMIT 1
       ) decision ON TRUE
       LEFT JOIN users decision_actor ON decision_actor.id = decision.actor_user_id
      WHERE organization_audit_logs.event_type = $1
      ORDER BY organization_audit_logs.created_at DESC
      LIMIT $2`,
    [AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REQUESTED, safeLimit]
  );

  return rows.map((row) => ({
    ...withAuditOrigin(row),
    status: row.decision_event_type === AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_APPROVED
      ? 'approved'
      : row.decision_event_type === AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REJECTED
        ? 'rejected'
        : 'pending',
    decision: row.decision_event_type ? {
      event_type: row.decision_event_type,
      event_label: AUDIT_EVENT_LABELS[row.decision_event_type] || row.decision_event_type,
      created_at: row.decision_created_at,
      note: row.decision_note,
      actor_name: row.decision_actor_name,
      actor_email: row.decision_actor_email
    } : null,
    event_label: AUDIT_EVENT_LABELS[row.event_type] || row.event_type
  }));
};

const getOrganizationSubscriptionHistory = async (organizationId, { limit = 12 } = {}, db = query) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const { rows } = await db(
    `SELECT ledger.id,
            ledger.organization_id,
            ledger.actor_user_id,
            u.name AS actor_name,
            u.email AS actor_email,
            ledger.event_type,
            ledger.status,
            ledger.subscription_plan,
            ledger.amount,
            ledger.currency,
            ledger.billing_period_months,
            ledger.effective_at,
            ledger.renewal_at,
            ledger.note,
            ledger.metadata,
            ledger.created_at
       FROM organization_subscription_ledger ledger
       LEFT JOIN users u ON u.id = ledger.actor_user_id
      WHERE ledger.organization_id = $1
      ORDER BY ledger.created_at DESC
      LIMIT $2`,
    [organizationId, safeLimit]
  );

  return rows.map((row) => ({
    ...withAuditOrigin(row),
    event_label: row.event_type,
    title: row.status === 'pending'
      ? 'Paket Değişikliği Bekliyor'
      : row.status === 'approved'
        ? 'Paket Değişikliği Onaylandı'
        : row.status === 'rejected'
          ? 'Paket Değişikliği Reddedildi'
          : row.status === 'trial'
            ? 'Trial Abonelik'
            : 'Aktif Abonelik',
    description: row.note || `Paket: ${row.subscription_plan} • ${row.amount} ${row.currency}`
  }));
};

const getOrganizationInvoices = async (organizationId, { limit = 6 } = {}, db = query) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 24);
  await syncOverdueInvoices(db);

  const [listResult, summaryResult] = await Promise.all([
    db(
      `SELECT invoice.id,
              invoice.organization_id,
              invoice.actor_user_id,
              u.name AS actor_name,
              u.email AS actor_email,
              invoice.invoice_number,
              invoice.subscription_plan,
              invoice.amount,
              invoice.currency,
              invoice.status,
              invoice.billing_period_start,
              invoice.billing_period_end,
              invoice.issued_at,
              invoice.due_date,
              invoice.paid_at,
              invoice.note,
              invoice.metadata,
              invoice.created_at,
              invoice.updated_at
         FROM organization_invoices invoice
         LEFT JOIN users u ON u.id = invoice.actor_user_id
        WHERE invoice.organization_id = $1
        ORDER BY invoice.billing_period_start DESC, invoice.created_at DESC
        LIMIT $2`,
      [organizationId, safeLimit]
    ),
    db(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
              COUNT(*) FILTER (WHERE status = 'unpaid')::int AS unpaid_count,
              COUNT(*) FILTER (WHERE status = 'overdue')::int AS overdue_count,
              COALESCE(SUM(amount) FILTER (WHERE status IN ('unpaid', 'overdue')), 0)::numeric(12,2) AS open_amount,
              COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0)::numeric(12,2) AS overdue_amount,
              COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::numeric(12,2) AS paid_amount
         FROM organization_invoices
        WHERE organization_id = $1`,
      [organizationId]
    )
  ]);

  return {
    rows: listResult.rows.map((row) => ({
      ...withAuditOrigin(row)
    })),
    summary: summaryResult.rows[0]
  };
};

const getPlatformMetrics = async ({ months = 6 } = {}, db = query) => {
  const safeMonths = Math.min(Math.max(Number(months) || 6, 3), 12);
  const { rows } = await db(
    `WITH months AS (
       SELECT date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * gs.n) AS month_start
       FROM generate_series($1::int - 1, 0, -1) AS gs(n)
     )
     SELECT month_start::date,
            COUNT(*) FILTER (WHERE l.event_type = '${AUDIT_EVENT_TYPES.ORGANIZATION_CREATED}')::int AS organizations_created,
            COUNT(*) FILTER (WHERE l.event_type = '${AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REQUESTED}')::int AS plan_requests,
            COUNT(*) FILTER (WHERE l.event_type = '${AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_APPROVED}')::int AS plan_approvals,
            COUNT(*) FILTER (WHERE l.event_type = '${AUDIT_EVENT_TYPES.ORGANIZATION_DEACTIVATED}')::int AS deactivations,
            COUNT(*) FILTER (WHERE l.event_type = '${AUDIT_EVENT_TYPES.ORGANIZATION_ACTIVATED}')::int AS activations
       FROM months
       LEFT JOIN organization_audit_logs l
         ON l.created_at >= month_start
        AND l.created_at < month_start + INTERVAL '1 month'
        AND l.event_type IN (
          '${AUDIT_EVENT_TYPES.ORGANIZATION_CREATED}',
          '${AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REQUESTED}',
          '${AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_APPROVED}',
          '${AUDIT_EVENT_TYPES.ORGANIZATION_DEACTIVATED}',
          '${AUDIT_EVENT_TYPES.ORGANIZATION_ACTIVATED}'
        )
      GROUP BY month_start
      ORDER BY month_start ASC`,
    [safeMonths]
  );

  const mrrResult = await db(
    `WITH latest_ledger AS (
       SELECT DISTINCT ON (organization_id)
              organization_id,
              status,
              subscription_plan,
              amount,
              renewal_at
       FROM organization_subscription_ledger
       ORDER BY organization_id, created_at DESC
     )
     SELECT COALESCE(SUM(CASE WHEN status IN ('active','approved','trial') THEN amount ELSE 0 END), 0)::int AS estimated_mrr,
            COUNT(*) FILTER (WHERE status = 'trial')::int AS active_trials,
            COUNT(*) FILTER (WHERE status IN ('active','approved'))::int AS active_paid_subscriptions
     FROM latest_ledger`
  );

  return {
    monthly: rows,
    summary: mrrResult.rows[0]
  };
};

const toAuditCsv = (rows) => {
  const header = ['Tarih', 'Event Kodu', 'Event', 'Varlik Tipi', 'Varlik ID', 'Islemi Yapan', 'Yapan E-Posta', 'Baslik', 'Aciklama', 'Detaylar(JSON)'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((row) => [
    row.created_at,
    row.event_type,
    AUDIT_EVENT_LABELS[row.event_type] || row.event_type,
    row.entity_type,
    row.entity_id,
    row.actor_name || '-',
    row.actor_email || '-',
    row.title,
    row.description,
    JSON.stringify(row.metadata || {})
  ].map(escape).join(';'));

  return ['sep=;', header.map(escape).join(';'), ...lines].join('\n');
};

const ensureLimitsDoNotUnderrunUsage = async (organizationId, payload, db = query) => {
  if (payload.max_users === undefined && payload.max_properties === undefined) {
    return;
  }

  const usage = await getOrganizationUsage(organizationId, db);

  if (payload.max_users !== undefined && usage.users > payload.max_users) {
    throw createAppError(`Mevcut kullanıcı sayısı ${usage.users}. Limit bunun altına düşürülemez`, 400);
  }

  if (payload.max_properties !== undefined && usage.properties > payload.max_properties) {
    throw createAppError(`Mevcut mülk sayısı ${usage.properties}. Limit bunun altına düşürülemez`, 400);
  }
};

const normalizeOrganizationPayload = (payload, { partial = false } = {}) => {
  const normalized = {};

  if (!partial || payload.name !== undefined) {
    const name = payload.name?.trim();
    if (!partial && !name) {
      throw createAppError('Organizasyon adi zorunlu', 400);
    }
    if (name) normalized.name = name;
  }

  if (payload.slug !== undefined || (!partial && payload.name !== undefined)) {
    const baseSlug = payload.slug || payload.name;
    const slug = slugifyOrganizationName(baseSlug || '');
    if (!partial && !slug) {
      throw createAppError('Gecerli bir organizasyon kisa adi gerekli', 400);
    }
    if (slug) normalized.slug = slug;
  }

  if (payload.contact_email !== undefined) normalized.contact_email = payload.contact_email?.trim() || null;
  if (payload.contact_phone !== undefined) normalized.contact_phone = payload.contact_phone?.trim() || null;

  const plan = payload.subscription_plan;
  if (!partial || plan !== undefined) {
    const safePlan = plan || 'starter';
    if (!VALID_PLANS.includes(safePlan)) {
      throw createAppError('Gecersiz paket tipi', 400);
    }
    normalized.subscription_plan = safePlan;
  }

  const effectivePlan = normalized.subscription_plan || payload.subscription_plan || 'starter';
  const defaults = getPlanDefaults(effectivePlan);

  if (!partial || payload.max_users !== undefined) {
    normalized.max_users = payload.max_users !== undefined && payload.max_users !== null && payload.max_users !== ''
      ? Number(payload.max_users)
      : defaults.max_users;
    if (!Number.isInteger(normalized.max_users) || normalized.max_users < 1) {
      throw createAppError('Maksimum kullanici sayisi en az 1 olmali', 400);
    }
  }

  if (!partial || payload.max_properties !== undefined) {
    normalized.max_properties = payload.max_properties !== undefined && payload.max_properties !== null && payload.max_properties !== ''
      ? Number(payload.max_properties)
      : defaults.max_properties;
    if (!Number.isInteger(normalized.max_properties) || normalized.max_properties < 1) {
      throw createAppError('Maksimum mulk sayisi en az 1 olmali', 400);
    }
  }

  if (payload.is_active !== undefined) normalized.is_active = payload.is_active === true || payload.is_active === 'true';
  if (payload.trial_ends_at !== undefined) normalized.trial_ends_at = payload.trial_ends_at || null;

  return normalized;
};

const list = async (req, res, next) => {
  try {
    const isPlatformAdmin = req.user?.role === 'platform_admin';
    const params = [];
    const whereClause = isPlatformAdmin
      ? ''
      : 'WHERE o.id = $1';

    if (!isPlatformAdmin) {
      params.push(req.organizationId);
    }

    const { rows } = await query(
      `SELECT o.*,
              (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role <> 'platform_admin') AS user_count,
              (SELECT COUNT(*)::int FROM properties p WHERE p.organization_id = o.id) AS property_count,
              (SELECT COUNT(*)::int FROM contracts c WHERE c.organization_id = o.id AND c.status = 'active') AS active_contract_count
       FROM organizations o
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.*,
              (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.role <> 'platform_admin') AS user_count,
              (SELECT COUNT(*)::int FROM properties p WHERE p.organization_id = o.id) AS property_count,
              (SELECT COUNT(*)::int FROM contracts c WHERE c.organization_id = o.id AND c.status = 'active') AS active_contract_count
       FROM organizations o
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Organizasyon bulunamadi' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const activity = async (req, res, next) => {
  try {
    const organizationId = req.targetOrganization.id;
    const [usage, usageHistory, recentActivity] = await Promise.all([
      getOrganizationUsage(organizationId),
      getOrganizationUsageHistory(organizationId),
      getOrganizationRecentActivity(organizationId)
    ]);

    res.json({
      success: true,
      data: {
        usage,
        usage_history: usageHistory,
        recent_activity: recentActivity
      }
    });
  } catch (err) {
    next(err);
  }
};

const auditLog = async (req, res, next) => {
  try {
    const result = await getOrganizationAuditLog(req.targetOrganization.id, req.query);
    res.json({ success: true, data: result.rows, meta: result.meta, summary: result.summary });
  } catch (err) {
    next(err);
  }
};

const exportAuditLog = async (req, res, next) => {
  try {
    const result = await getOrganizationAuditLog(req.targetOrganization.id, { ...req.query, page: 1, limit: 1000 });
    const csv = toAuditCsv(result.rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="organization-audit-${req.targetOrganization.slug}.csv"`);
    res.status(200).send(`\uFEFF${csv}`);
  } catch (err) {
    next(err);
  }
};

const listPlanRequests = async (req, res, next) => {
  try {
    const rows = await getOrganizationPlanRequests(req.query);
    res.json({
      success: true,
      data: rows,
      summary: {
        total: rows.length,
        organizations: new Set(rows.map((row) => row.organization_id)).size
      }
    });
  } catch (err) {
    next(err);
  }
};

const subscriptionHistory = async (req, res, next) => {
  try {
    const rows = await getOrganizationSubscriptionHistory(req.targetOrganization.id, req.query);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

const invoices = async (req, res, next) => {
  try {
    const result = await getOrganizationInvoices(req.targetOrganization.id, req.query);
    res.json({ success: true, data: result.rows, summary: result.summary });
  } catch (err) {
    next(err);
  }
};

const platformMetrics = async (req, res, next) => {
  try {
    await syncOverdueInvoices();
    const result = await getPlatformMetrics(req.query);
    res.json({ success: true, data: result.monthly, summary: result.summary });
  } catch (err) {
    next(err);
  }
};

const requestPlanChange = async (req, res, next) => {
  try {
    const requestedPlan = req.body.target_plan;
    const note = req.body.note?.trim() || null;

    if (!VALID_PLANS.includes(requestedPlan)) {
      throw createAppError('Gecersiz paket tipi', 400);
    }

    if (requestedPlan === req.targetOrganization.subscription_plan) {
      throw createAppError('Mevcut paketiniz zaten secili', 400);
    }

    const requestEvent = await recordOrganizationAuditEvent({
      organizationId: req.targetOrganization.id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REQUESTED,
      entityType: 'organization',
      entityId: req.targetOrganization.id,
      title: req.targetOrganization.name,
      description: `Paket degisikligi talebi: ${req.targetOrganization.subscription_plan} -> ${requestedPlan}`,
      metadata: {
        current_plan: req.targetOrganization.subscription_plan,
        requested_plan: requestedPlan,
        note,
        requested_by_email: req.user?.email || null,
        requested_by_name: req.user?.name || null
      }
    });

    await recordSubscriptionLedgerEntry({
      organizationId: req.targetOrganization.id,
      actorUserId: req.user?.id || null,
      relatedRequestId: requestEvent.id,
      eventType: 'plan_change_requested',
      status: 'pending',
      subscriptionPlan: requestedPlan,
      effectiveAt: new Date().toISOString(),
      renewalAt: buildRenewalAt(req.targetOrganization.trial_ends_at),
      note: note || `Paket degisikligi talebi: ${req.targetOrganization.subscription_plan} -> ${requestedPlan}`,
      metadata: {
        current_plan: req.targetOrganization.subscription_plan,
        requested_plan: requestedPlan,
        request_id: requestEvent.id,
        source: 'tenant_request'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Paket degisikligi talebi alindi',
      data: {
        organization_id: req.targetOrganization.id,
        current_plan: req.targetOrganization.subscription_plan,
        requested_plan: requestedPlan,
        note
      }
    });
  } catch (err) {
    next(err);
  }
};

const resolvePlanRequest = async (req, res, next) => {
  try {
    const requestId = req.params.requestId;
    const action = req.body.action;
    const decisionNote = req.body.note?.trim() || null;

    if (!['approve', 'reject'].includes(action)) {
      throw createAppError('Gecersiz talep karari', 400);
    }

    const { rows } = await query(
      `SELECT organization_audit_logs.*, o.subscription_plan AS current_plan, o.name AS organization_name
         FROM organization_audit_logs
         JOIN organizations o ON o.id = organization_audit_logs.organization_id
        WHERE organization_audit_logs.id = $1
          AND organization_audit_logs.event_type = $2`,
      [requestId, AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REQUESTED]
    );

    if (!rows.length) {
      throw createAppError('Paket talebi bulunamadi', 404);
    }

    const requestRow = rows[0];
    const existingDecisions = await query(
      `SELECT id FROM organization_audit_logs
        WHERE organization_id = $1
          AND event_type IN ($2, $3)
          AND metadata->>'request_id' = $4
        LIMIT 1`,
      [
        requestRow.organization_id,
        AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_APPROVED,
        AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REJECTED,
        String(requestId)
      ]
    );

    if (existingDecisions.rows.length) {
      throw createAppError('Bu talep zaten karara baglanmis', 409);
    }

    const requestedPlan = requestRow.metadata?.requested_plan;
    if (!VALID_PLANS.includes(requestedPlan)) {
      throw createAppError('Talep edilen paket gecersiz', 400);
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const db = client.query.bind(client);

      if (action === 'approve') {
        const usage = await getOrganizationUsage(requestRow.organization_id, db);
        const defaults = getPlanDefaults(requestedPlan);
        const nextMaxUsers = Math.max(defaults.max_users, usage.users);
        const nextMaxProperties = Math.max(defaults.max_properties, usage.properties);
        const effectiveAt = new Date().toISOString();

        await db(
          `UPDATE organizations
              SET subscription_plan = $1,
                  max_users = $2,
                  max_properties = $3,
                  updated_at = NOW()
            WHERE id = $4`,
          [requestedPlan, nextMaxUsers, nextMaxProperties, requestRow.organization_id]
        );

        await recordOrganizationAuditEvent({
          organizationId: requestRow.organization_id,
          actorUserId: req.user?.id || null,
          eventType: AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_APPROVED,
          entityType: 'organization',
          entityId: requestRow.organization_id,
          title: requestRow.organization_name,
          description: `Paket talebi onaylandi: ${requestRow.current_plan} -> ${requestedPlan}`,
          metadata: {
            request_id: String(requestId),
            previous_plan: requestRow.current_plan,
            approved_plan: requestedPlan,
            decision_note: decisionNote,
            max_users: nextMaxUsers,
            max_properties: nextMaxProperties
          },
          db
        });

        await recordSubscriptionLedgerEntry({
          organizationId: requestRow.organization_id,
          actorUserId: req.user?.id || null,
          relatedRequestId: requestId,
          eventType: 'plan_change_approved',
          status: 'approved',
          subscriptionPlan: requestedPlan,
          effectiveAt,
          renewalAt: buildRenewalAt(null, effectiveAt),
          note: decisionNote || `Paket onaylandi: ${requestRow.current_plan} -> ${requestedPlan}`,
          metadata: {
            previous_plan: requestRow.current_plan,
            approved_plan: requestedPlan,
            request_id: String(requestId),
            max_users: nextMaxUsers,
            max_properties: nextMaxProperties,
            source: 'platform_admin_decision'
          },
          db
        });

        await upsertOrganizationInvoice({
          organizationId: requestRow.organization_id,
          actorUserId: req.user?.id || null,
          subscriptionPlan: requestedPlan,
          issuedAt: effectiveAt,
          note: `Onaylanan paket için aylık fatura: ${requestedPlan}`,
          metadata: {
            source: 'plan_request_approved',
            request_id: String(requestId),
            previous_plan: requestRow.current_plan
          },
          db
        });
      } else {
        await recordOrganizationAuditEvent({
          organizationId: requestRow.organization_id,
          actorUserId: req.user?.id || null,
          eventType: AUDIT_EVENT_TYPES.ORGANIZATION_PLAN_CHANGE_REJECTED,
          entityType: 'organization',
          entityId: requestRow.organization_id,
          title: requestRow.organization_name,
          description: `Paket talebi reddedildi: ${requestRow.current_plan} -> ${requestedPlan}`,
          metadata: {
            request_id: String(requestId),
            previous_plan: requestRow.current_plan,
            requested_plan: requestedPlan,
            decision_note: decisionNote
          },
          db
        });

        await recordSubscriptionLedgerEntry({
          organizationId: requestRow.organization_id,
          actorUserId: req.user?.id || null,
          relatedRequestId: requestId,
          eventType: 'plan_change_rejected',
          status: 'rejected',
          subscriptionPlan: requestedPlan,
          effectiveAt: new Date().toISOString(),
          renewalAt: buildRenewalAt(null),
          note: decisionNote || `Paket reddedildi: ${requestRow.current_plan} -> ${requestedPlan}`,
          metadata: {
            previous_plan: requestRow.current_plan,
            requested_plan: requestedPlan,
            request_id: String(requestId),
            source: 'platform_admin_decision'
          },
          db
        });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, message: action === 'approve' ? 'Talep onaylandi' : 'Talep reddedildi' });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await getClient();
  try {
    const payload = normalizeOrganizationPayload(req.body);
    const adminPayload = normalizeAdminPayload(req.body);

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO organizations (
        name,
        slug,
        contact_email,
        contact_phone,
        subscription_plan,
        max_users,
        max_properties,
        is_active,
        trial_ends_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        payload.name,
        payload.slug,
        payload.contact_email || null,
        payload.contact_phone || null,
        payload.subscription_plan,
        payload.max_users,
        payload.max_properties,
        payload.is_active !== undefined ? payload.is_active : true,
        payload.trial_ends_at || null
      ]
    );

    const organization = rows[0];
    const passwordHash = await bcrypt.hash(adminPayload.password, 12);

    const adminResult = await client.query(
      `INSERT INTO users (organization_id, name, email, password, role, phone)
       VALUES ($1, $2, $3, $4, 'admin', $5)
       RETURNING id, organization_id, name, email, role, phone, created_at`,
      [organization.id, adminPayload.name, adminPayload.email, passwordHash, adminPayload.phone || null]
    );

    const db = client.query.bind(client);
    await recordOrganizationAuditEvent({
      organizationId: organization.id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.ORGANIZATION_CREATED,
      entityType: 'organization',
      entityId: organization.id,
      title: organization.name,
      description: `Paket: ${organization.subscription_plan} • Limitler: ${organization.max_users} kullanici / ${organization.max_properties} mulk`,
      metadata: {
        subscription_plan: organization.subscription_plan,
        max_users: organization.max_users,
        max_properties: organization.max_properties,
        is_active: organization.is_active
      },
      occurredAt: organization.created_at,
      db
    });

    await recordOrganizationAuditEvent({
      organizationId: organization.id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.USER_CREATED,
      entityType: 'user',
      entityId: adminResult.rows[0].id,
      title: adminResult.rows[0].name,
      description: `Bootstrap admin olusturuldu: ${adminResult.rows[0].email}`,
      metadata: {
        role: adminResult.rows[0].role,
        email: adminResult.rows[0].email,
        bootstrap: true
      },
      occurredAt: adminResult.rows[0].created_at,
      db
    });

    await recordSubscriptionLedgerEntry({
      organizationId: organization.id,
      actorUserId: req.user?.id || null,
      eventType: 'subscription_started',
      status: organization.trial_ends_at ? 'trial' : 'active',
      subscriptionPlan: organization.subscription_plan,
      effectiveAt: organization.created_at,
      renewalAt: buildRenewalAt(organization.trial_ends_at, organization.created_at),
      note: organization.trial_ends_at ? 'Organizasyon deneme aboneligi baslatildi' : 'Organizasyon aktif abonelik ile baslatildi',
      metadata: {
        max_users: organization.max_users,
        max_properties: organization.max_properties,
        source: 'organization_create'
      },
      createdAt: organization.created_at,
      db
    });

    await upsertOrganizationInvoice({
      organizationId: organization.id,
      actorUserId: req.user?.id || null,
      subscriptionPlan: organization.subscription_plan,
      trialEndsAt: organization.trial_ends_at,
      issuedAt: organization.created_at,
      note: organization.trial_ends_at ? 'Trial sonrası tahsil edilecek başlangıç faturası' : 'Başlangıç aylık paket faturası',
      metadata: {
        source: 'organization_create',
        max_users: organization.max_users,
        max_properties: organization.max_properties
      },
      db
    });

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        ...organization,
        bootstrap_admin: adminResult.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const updateAdminCredentials = async (req, res, next) => {
  try {
    const organizationId = req.targetOrganization?.id || String(req.params.id || '').trim();
    const currentEmail = String(req.body.current_email || '').trim().toLowerCase();
    const nextEmail = req.body.admin_email === undefined
      ? null
      : (String(req.body.admin_email || '').trim().toLowerCase() || null);
    const nextPassword = req.body.admin_password === undefined
      ? null
      : String(req.body.admin_password || '');

    if (!organizationId) {
      throw createAppError('Organizasyon kimligi gerekli', 400);
    }

    if (!currentEmail && !nextEmail) {
      throw createAppError('Guncellenecek admin e-postasi gerekli', 400);
    }

    if (nextPassword !== null && nextPassword.length < 8) {
      throw createAppError('Admin sifresi en az 8 karakter olmali', 400);
    }

    if (nextEmail === null && nextPassword === null) {
      throw createAppError('Guncellenecek admin bilgisi bulunamadi', 400);
    }

    const updates = [];
    const values = [];

    if (nextEmail !== null) {
      values.push(nextEmail);
      updates.push(`email = $${values.length}`);
    }

    if (nextPassword !== null) {
      const passwordHash = await bcrypt.hash(nextPassword, 12);
      values.push(passwordHash);
      updates.push(`password = $${values.length}`);
    }

    values.push(organizationId);
    const organizationIndex = values.length;
    values.push(currentEmail || nextEmail);
    const emailIndex = values.length;

    const { rows } = await query(
      `UPDATE users
          SET ${updates.join(', ')},
              updated_at = NOW()
        WHERE id = (
          SELECT id
          FROM users
          WHERE organization_id = $${organizationIndex}
            AND role = 'admin'
            AND email = $${emailIndex}
          ORDER BY created_at ASC
          LIMIT 1
        )
        RETURNING id, organization_id, name, email, role, phone, is_active, created_at, updated_at`,
      values
    );

    if (!rows.length) {
      throw createAppError('Guncellenecek tenant admin kullanicisi bulunamadi', 404);
    }

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.USER_UPDATED,
      entityType: 'user',
      entityId: rows[0].id,
      title: rows[0].name,
      description: 'Tenant admin giris bilgileri guncellendi',
      metadata: {
        current_email: currentEmail || null,
        next_email: nextEmail,
        password_updated: nextPassword !== null
      }
    });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const payload = normalizeOrganizationPayload(req.body, { partial: true });
    const entries = Object.entries(payload);
    if (!entries.length) {
      return res.status(400).json({ success: false, message: 'Guncellenecek alan gerekli' });
    }

    await ensureLimitsDoNotUnderrunUsage(req.params.id, payload);

    const setClause = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
    const values = entries.map(([, value]) => value);
    values.push(req.params.id);

    const { rows } = await query(
      `UPDATE organizations
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Organizasyon bulunamadi' });
    }

    const previousOrganization = req.targetOrganization;
    const updatedOrganization = rows[0];

    if (
      payload.subscription_plan &&
      payload.subscription_plan !== previousOrganization.subscription_plan
    ) {
      await recordSubscriptionLedgerEntry({
        organizationId: updatedOrganization.id,
        actorUserId: req.user?.id || null,
        eventType: 'subscription_updated',
        status: 'active',
        subscriptionPlan: updatedOrganization.subscription_plan,
        effectiveAt: updatedOrganization.updated_at,
        renewalAt: buildRenewalAt(updatedOrganization.trial_ends_at, updatedOrganization.updated_at),
        note: `Super admin paket guncelledi: ${previousOrganization.subscription_plan} -> ${updatedOrganization.subscription_plan}`,
        metadata: {
          previous_plan: previousOrganization.subscription_plan,
          max_users: updatedOrganization.max_users,
          max_properties: updatedOrganization.max_properties,
          source: 'organization_update'
        }
      });

      await upsertOrganizationInvoice({
        organizationId: updatedOrganization.id,
        actorUserId: req.user?.id || null,
        subscriptionPlan: updatedOrganization.subscription_plan,
        trialEndsAt: updatedOrganization.trial_ends_at,
        issuedAt: updatedOrganization.updated_at,
        note: `Paket güncellemesi sonrası fatura: ${updatedOrganization.subscription_plan}`,
        metadata: {
          source: 'organization_update',
          previous_plan: previousOrganization.subscription_plan
        }
      });
    }

    await recordOrganizationAuditEvent({
      organizationId: updatedOrganization.id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.ORGANIZATION_UPDATED,
      entityType: 'organization',
      entityId: updatedOrganization.id,
      title: updatedOrganization.name,
      description: 'Organizasyon ayarlari guncellendi',
      metadata: payload
    });

    res.json({ success: true, data: updatedOrganization });
  } catch (err) {
    next(err);
  }
};

const setStatus = async (req, res, next) => {
  try {
    if (req.targetOrganization.id === req.organizationId && req.body.is_active === false) {
      throw createAppError('Kendi organizasyonunuzu pasife alamazsınız', 400);
    }

    const isActive = req.body.is_active === true || req.body.is_active === 'true';
    const { rows } = await query(
      `UPDATE organizations
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [isActive, req.targetOrganization.id]
    );

    await recordOrganizationAuditEvent({
      organizationId: rows[0].id,
      actorUserId: req.user?.id || null,
      eventType: isActive ? AUDIT_EVENT_TYPES.ORGANIZATION_ACTIVATED : AUDIT_EVENT_TYPES.ORGANIZATION_DEACTIVATED,
      entityType: 'organization',
      entityId: rows[0].id,
      title: rows[0].name,
      description: isActive ? 'Organizasyon tekrar aktif edildi' : 'Organizasyon pasife alindi',
      metadata: { is_active: isActive }
    });

    await recordSubscriptionLedgerEntry({
      organizationId: rows[0].id,
      actorUserId: req.user?.id || null,
      eventType: isActive ? 'subscription_reactivated' : 'subscription_cancelled',
      status: isActive ? 'active' : 'cancelled',
      subscriptionPlan: rows[0].subscription_plan,
      effectiveAt: rows[0].updated_at,
      renewalAt: buildRenewalAt(rows[0].trial_ends_at, rows[0].updated_at),
      note: isActive ? 'Organizasyon tekrar aktif edildi' : 'Organizasyon pasife alindi',
      metadata: {
        is_active: isActive,
        source: 'organization_status_change'
      }
    });

    if (isActive) {
      await upsertOrganizationInvoice({
        organizationId: rows[0].id,
        actorUserId: req.user?.id || null,
        subscriptionPlan: rows[0].subscription_plan,
        trialEndsAt: rows[0].trial_ends_at,
        issuedAt: rows[0].updated_at,
        note: 'Organizasyon yeniden aktive edildi, aylık fatura yenilendi',
        metadata: {
          source: 'organization_status_change',
          is_active: true
        }
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const setInvoiceStatus = async (req, res, next) => {
  try {
    const requestedStatus = req.body.status;
    if (!['paid', 'unpaid', 'overdue'].includes(requestedStatus)) {
      throw createAppError('Geçersiz fatura durumu', 400);
    }

    await syncOverdueInvoices();
    const { rows } = await query(
      `SELECT invoice.*, o.name AS organization_name
         FROM organization_invoices invoice
         JOIN organizations o ON o.id = invoice.organization_id
        WHERE invoice.id = $1`,
      [req.params.invoiceId]
    );

    if (!rows.length) {
      throw createAppError('Fatura bulunamadı', 404);
    }

    const invoice = rows[0];
    const nextStatus = requestedStatus === 'paid'
      ? 'paid'
      : normalizeInvoiceStatus(requestedStatus, invoice.due_date);
    const paidAt = nextStatus === 'paid' ? new Date().toISOString() : null;
    const updateResult = await query(
      `UPDATE organization_invoices
          SET actor_user_id = $1,
              status = $2,
              paid_at = $3,
              updated_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
        WHERE id = $5
        RETURNING *`,
      [
        req.user?.id || null,
        nextStatus,
        paidAt,
        JSON.stringify({
          last_status_update_by: req.user?.email || null,
          last_status_update_at: new Date().toISOString()
        }),
        invoice.id
      ]
    );

    await recordOrganizationAuditEvent({
      organizationId: invoice.organization_id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.INVOICE_STATUS_UPDATED,
      entityType: 'invoice',
      entityId: invoice.id,
      title: invoice.invoice_number,
      description: `Fatura durumu güncellendi: ${invoice.status} -> ${nextStatus}`,
      metadata: {
        invoice_number: invoice.invoice_number,
        previous_status: invoice.status,
        next_status: nextStatus,
        amount: invoice.amount,
        paid_at: paidAt
      }
    });

    res.json({ success: true, data: updateResult.rows[0] });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    if (req.targetOrganization.id === req.organizationId) {
      throw createAppError('Kendi organizasyonunuzu silemezsiniz', 400);
    }

    const usage = await getOrganizationUsage(req.targetOrganization.id);
    const blockingEntries = Object.entries(usage).filter(([, total]) => total > 0);

    if (blockingEntries.length) {
      throw createAppError('Organizasyona bağlı kayıtlar olduğu için silinemez. Önce pasife alın.', 409);
    }

    await recordOrganizationAuditEvent({
      organizationId: req.targetOrganization.id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.ORGANIZATION_DELETED,
      entityType: 'organization',
      entityId: req.targetOrganization.id,
      title: req.targetOrganization.name,
      description: 'Organizasyon kalici olarak silindi',
      metadata: { slug: req.targetOrganization.slug }
    });

    await query('DELETE FROM organizations WHERE id = $1', [req.targetOrganization.id]);
    res.json({ success: true, message: 'Organizasyon silindi' });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, get, activity, auditLog, exportAuditLog, listPlanRequests, requestPlanChange, resolvePlanRequest, subscriptionHistory, invoices, platformMetrics, create, updateAdminCredentials, update, setStatus, setInvoiceStatus, remove };