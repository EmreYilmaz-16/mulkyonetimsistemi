const { query } = require('../config/database');
const { AUDIT_EVENT_TYPE_SET } = require('./organizationAudit');

const PLAN_DEFAULTS = {
  starter: { max_users: 3, max_properties: 25 },
  pro: { max_users: 10, max_properties: 150 },
  enterprise: { max_users: 50, max_properties: 1000 }
};

const LIMIT_CONFIG = {
  users: { column: 'max_users', table: 'users', label: 'kullanici' },
  properties: { column: 'max_properties', table: 'properties', label: 'mulk' }
};

const createAppError = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const slugifyOrganizationName = (value = '') => value
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 160);

const requireOrganizationId = (req) => {
  const organizationId = req.organizationId || req.user?.organization_id || null;
  if (!organizationId) {
    throw createAppError('Organizasyon bilgisi bulunamadi', 403);
  }
  return organizationId;
};

const getOrganization = async (organizationId, db = query) => {
  const { rows } = await db(
    `SELECT id,
            name,
            slug,
            contact_email,
            contact_phone,
            subscription_plan,
            max_users,
            max_properties,
            is_active,
            trial_ends_at,
            created_at,
            updated_at
     FROM organizations
     WHERE id = $1`,
    [organizationId]
  );

  if (!rows.length) {
    throw createAppError('Organizasyon bulunamadi', 404);
  }

  return rows[0];
};

const assertOrganizationWritable = (organization) => {
  if (!organization.is_active) {
    throw createAppError('Organizasyon hesabi pasif durumda', 403);
  }

  if (organization.trial_ends_at && new Date(organization.trial_ends_at) < new Date()) {
    throw createAppError('Organizasyon deneme suresi sona ermis', 403);
  }
};

const assertOrganizationLimit = async (organizationId, resourceType, db = query) => {
  const config = LIMIT_CONFIG[resourceType];
  if (!config) {
    throw createAppError('Gecersiz limit turu', 500);
  }

  const organization = await getOrganization(organizationId, db);
  assertOrganizationWritable(organization);

  const limitValue = Number(organization[config.column]);
  if (!Number.isFinite(limitValue) || limitValue <= 0) {
    return organization;
  }

  const countSql = resourceType === 'users'
    ? `SELECT COUNT(*)::int AS total FROM ${config.table} WHERE organization_id = $1 AND role <> 'platform_admin'`
    : `SELECT COUNT(*)::int AS total FROM ${config.table} WHERE organization_id = $1`;

  const { rows } = await db(countSql, [organizationId]);

  if (rows[0].total >= limitValue) {
    throw createAppError(
      `Organizasyon ${config.label} limiti dolu. Mevcut paket en fazla ${limitValue} ${config.label} destekliyor.`,
      403
    );
  }

  return organization;
};

const ensureEntityBelongsToOrganization = async ({
  tableName,
  entityId,
  organizationId,
  db = query,
  selectClause = 'id',
  message = 'Iliskili kayit bulunamadi'
}) => {
  const { rows } = await db(
    `SELECT ${selectClause} FROM ${tableName} WHERE id = $1 AND organization_id = $2`,
    [entityId, organizationId]
  );

  if (!rows.length) {
    throw createAppError(message, 404);
  }

  return rows[0];
};

const ensureOptionalEntityBelongsToOrganization = async ({
  tableName,
  entityId,
  organizationId,
  db = query,
  selectClause = 'id',
  message = 'Iliskili kayit bulunamadi'
}) => {
  if (!entityId) {
    return null;
  }

  return ensureEntityBelongsToOrganization({
    tableName,
    entityId,
    organizationId,
    db,
    selectClause,
    message
  });
};

const ensureEntitiesBelongToOrganization = async ({
  organizationId,
  db = query,
  entities = []
}) => Promise.all(
  entities.map((entity) => ensureOptionalEntityBelongsToOrganization({
    ...entity,
    organizationId,
    db
  }))
);

const deleteEntityBelongingToOrganization = async ({
  tableName,
  entityId,
  organizationId,
  db = query,
  returningClause = 'id',
  message = 'Kayit bulunamadi'
}) => {
  const { rows } = await db(
    `DELETE FROM ${tableName} WHERE id = $1 AND organization_id = $2 RETURNING ${returningClause}`,
    [entityId, organizationId]
  );

  if (!rows.length) {
    throw createAppError(message, 404);
  }

  return rows[0];
};

const recordOrganizationAuditEvent = async ({
  organizationId,
  actorUserId = null,
  eventType,
  entityType,
  entityId = null,
  title,
  description = null,
  metadata = {},
  occurredAt = null,
  db = query
}) => {
  if (!AUDIT_EVENT_TYPE_SET.has(eventType)) {
    throw createAppError(`Tanimsiz audit event tipi: ${eventType}`, 500);
  }

  return db(
  `INSERT INTO organization_audit_logs (
     organization_id,
     actor_user_id,
     event_type,
     entity_type,
     entity_id,
     title,
     description,
     metadata,
     created_at
   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [
    organizationId,
    actorUserId,
    eventType,
    entityType,
    entityId,
    title,
    description,
    metadata || {},
    occurredAt || new Date().toISOString()
  ]
  );
};

const getPlanDefaults = (plan) => PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.starter;

module.exports = {
  PLAN_DEFAULTS,
  createAppError,
  slugifyOrganizationName,
  requireOrganizationId,
  getOrganization,
  assertOrganizationWritable,
  assertOrganizationLimit,
  ensureEntityBelongsToOrganization,
  ensureOptionalEntityBelongsToOrganization,
  ensureEntitiesBelongToOrganization,
  deleteEntityBelongingToOrganization,
  recordOrganizationAuditEvent,
  getPlanDefaults
};