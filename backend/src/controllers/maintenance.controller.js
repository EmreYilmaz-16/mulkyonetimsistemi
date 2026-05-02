const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntitiesBelongToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

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
  try {
    const organizationId = req.organizationId;
    const { status, priority, assigned_to, cost, description } = req.body;
    const completedAt = status === 'completed' ? 'NOW()' : 'completed_at';
    const { rows } = await query(
      `UPDATE maintenance_requests SET
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        assigned_to = COALESCE($3, assigned_to),
        cost = COALESCE($4, cost),
        description = COALESCE($5, description),
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $6 AND organization_id = $7 RETURNING *`,
      [status, priority, assigned_to, cost, description, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Talep bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.MAINTENANCE_UPDATED, entityType: 'maintenance', entityId: rows[0].id, title: rows[0].title, description: `Bakim talebi guncellendi • Durum: ${rows[0].status}`, metadata: { status: rows[0].status, priority: rows[0].priority } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

module.exports = { list, get, create, update };
