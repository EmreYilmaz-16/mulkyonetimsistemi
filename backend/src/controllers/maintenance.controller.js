const { query, getClient } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntitiesBelongToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const buildMaintenanceExpenseDescription = (maintenanceRow) => `Bakim gideri — ${maintenanceRow.title} #${maintenanceRow.id.slice(0, 8)}`;

const normalizeNullableNumber = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
};

const syncMaintenanceExpense = async ({ client, organizationId, maintenanceRow, actorUserId, db }) => {
  const amount = Number(maintenanceRow.cost) || 0;
  const description = buildMaintenanceExpenseDescription(maintenanceRow);
  const effectiveDate = maintenanceRow.completed_at
    ? new Date(maintenanceRow.completed_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const shouldExist = maintenanceRow.status === 'completed' && amount > 0;

  const { rows: existingRows } = await client.query(
    `SELECT * FROM expenses
     WHERE organization_id = $1 AND description = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId, description]
  );

  const existingExpense = existingRows[0];

  if (!shouldExist) {
    if (existingExpense) {
      await client.query(
        'DELETE FROM expenses WHERE id = $1 AND organization_id = $2',
        [existingExpense.id, organizationId]
      );

      await recordOrganizationAuditEvent({
        organizationId,
        actorUserId,
        eventType: AUDIT_EVENT_TYPES.EXPENSE_DELETED,
        entityType: 'expense',
        entityId: existingExpense.id,
        title: 'maintenance',
        description: 'Bakim gider kaydi kaldirildi',
        metadata: { amount: existingExpense.amount, property_id: existingExpense.property_id, source: 'maintenance_request', maintenance_request_id: maintenanceRow.id },
        db
      });
    }
    return;
  }

  if (existingExpense) {
    await client.query(
      `UPDATE expenses SET
         property_id = $1,
         category = 'maintenance',
         amount = $2,
         date = $3,
         description = $4,
         updated_at = NOW()
       WHERE id = $5 AND organization_id = $6`,
      [maintenanceRow.property_id, amount, effectiveDate, description, existingExpense.id, organizationId]
    );

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId,
      eventType: AUDIT_EVENT_TYPES.EXPENSE_UPDATED,
      entityType: 'expense',
      entityId: existingExpense.id,
      title: 'maintenance',
      description: `Bakim gideri guncellendi • Tutar: ${amount}`,
      metadata: { amount, property_id: maintenanceRow.property_id, source: 'maintenance_request', maintenance_request_id: maintenanceRow.id },
      db
    });
    return;
  }

  const { rows: expenseRows } = await client.query(
    `INSERT INTO expenses (organization_id, property_id, category, amount, date, description)
     VALUES ($1, $2, 'maintenance', $3, $4, $5)
     RETURNING *`,
    [organizationId, maintenanceRow.property_id, amount, effectiveDate, description]
  );

  await recordOrganizationAuditEvent({
    organizationId,
    actorUserId,
    eventType: AUDIT_EVENT_TYPES.EXPENSE_CREATED,
    entityType: 'expense',
    entityId: expenseRows[0].id,
    title: 'maintenance',
    description: `Bakim gideri eklendi • Tutar: ${amount}`,
    metadata: { amount, property_id: maintenanceRow.property_id, source: 'maintenance_request', maintenance_request_id: maintenanceRow.id },
    db
  });
};

const list = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { status, priority, property_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [`m.organization_id = $1`];
    const params = [organizationId];
    let i = 2;

    if (status)      { conditions.push(`m.status = $${i++}`); params.push(status); }
    if (priority)    { conditions.push(`m.priority = $${i++}`); params.push(priority); }
    if (property_id) { conditions.push(`m.property_id = $${i++}`); params.push(property_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM maintenance_requests m ${where}`, params);
    const { rows } = await query(
      `SELECT m.*, p.name AS property_name,
              t.first_name || ' ' || t.last_name AS tenant_name
       FROM maintenance_requests m
       JOIN properties p ON p.id = m.property_id
       LEFT JOIN tenants t ON t.id = m.tenant_id
       ${where}
       ORDER BY
         CASE m.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         m.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, Number(limit), Number(offset)]
    );

    res.json({
      success: true,
      data: rows,
      meta: { total: Number(countRes.rows[0].count), page: Number(page), limit: Number(limit) }
    });
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { rows } = await query(
      `SELECT m.*, p.name AS property_name,
              t.first_name || ' ' || t.last_name AS tenant_name, t.phone AS tenant_phone
       FROM maintenance_requests m
       JOIN properties p ON p.id = m.property_id
       LEFT JOIN tenants t ON t.id = m.tenant_id
       WHERE m.id = $1 AND m.organization_id = $2`, [req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Talep bulunamadı' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, tenant_id, title, description, priority } = req.body;

    await ensureEntitiesBelongToOrganization({
      organizationId,
      entities: [
        { tableName: 'properties', entityId: property_id, message: 'Mulk bulunamadi' },
        { tableName: 'tenants', entityId: tenant_id, message: 'Kiraci bulunamadi' }
      ]
    });

    const { rows } = await query(
      `INSERT INTO maintenance_requests (organization_id, property_id, tenant_id, title, description, priority)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [organizationId, property_id, tenant_id || null, title, description || null, priority || 'normal']
    );
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.MAINTENANCE_CREATED, entityType: 'maintenance', entityId: rows[0].id, title: rows[0].title, description: `Bakim talebi olusturuldu • Oncelik: ${rows[0].priority}`, metadata: { property_id: rows[0].property_id, tenant_id: rows[0].tenant_id } });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  const client = await getClient();
  try {
    const organizationId = req.organizationId;
    const { status, priority, assigned_to, cost, description } = req.body;
    const normalizedCost = normalizeNullableNumber(cost);
    const db = client.query.bind(client);

    await client.query('BEGIN');

    const { rows: existingRows } = await client.query(
      `SELECT * FROM maintenance_requests
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [req.params.id, organizationId]
    );

    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Talep bulunamadı' });
    }

    const { rows } = await client.query(
      `UPDATE maintenance_requests SET
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        assigned_to = COALESCE($3, assigned_to),
        cost = CASE WHEN $4::numeric IS NULL THEN cost ELSE $4 END,
        description = COALESCE($5, description),
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $6 AND organization_id = $7 RETURNING *`,
      [status, priority, assigned_to, normalizedCost, description, req.params.id, organizationId]
    );

    await syncMaintenanceExpense({
      client,
      organizationId,
      maintenanceRow: rows[0],
      actorUserId: req.user?.id || null,
      db
    });

    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.MAINTENANCE_UPDATED, entityType: 'maintenance', entityId: rows[0].id, title: rows[0].title, description: `Bakim talebi guncellendi • Durum: ${rows[0].status}`, metadata: { status: rows[0].status, priority: rows[0].priority, cost: rows[0].cost }, db });

    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = { list, get, create, update };
