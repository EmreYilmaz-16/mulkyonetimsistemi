const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureOptionalEntityBelongsToOrganization,
  deleteEntityBelongingToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const list = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, category, from_date, to_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [`e.organization_id = $1`];
    const params = [organizationId];
    let i = 2;

    if (property_id) { conditions.push(`e.property_id = $${i++}`); params.push(property_id); }
    if (category)    { conditions.push(`e.category = $${i++}`); params.push(category); }
    if (from_date)   { conditions.push(`e.date >= $${i++}`); params.push(from_date); }
    if (to_date)     { conditions.push(`e.date <= $${i++}`); params.push(to_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM expenses e ${where}`, params);
    const { rows } = await query(
      `SELECT e.*, p.name AS property_name
       FROM expenses e
       LEFT JOIN properties p ON p.id = e.property_id
       ${where}
       ORDER BY e.date DESC
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

const create = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, category, amount, date, vendor, description, receipt_url } = req.body;

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await query(
      `INSERT INTO expenses (organization_id, property_id, category, amount, date, vendor, description, receipt_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [organizationId, property_id || null, category, amount, date, vendor || null, description || null, receipt_url || null]
    );
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.EXPENSE_CREATED, entityType: 'expense', entityId: rows[0].id, title: category, description: `Gider eklendi • Tutar: ${rows[0].amount}`, metadata: { amount: rows[0].amount, property_id: rows[0].property_id } });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, category, amount, date, vendor, description, receipt_url } = req.body;

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await query(
      `UPDATE expenses SET
        property_id = COALESCE($1, property_id),
        category = COALESCE($2, category),
        amount = COALESCE($3, amount),
        date = COALESCE($4, date),
        vendor = COALESCE($5, vendor),
        description = COALESCE($6, description),
        receipt_url = COALESCE($7, receipt_url)
       WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [property_id, category, amount, date, vendor, description, receipt_url, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Gider bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.EXPENSE_UPDATED, entityType: 'expense', entityId: rows[0].id, title: rows[0].category, description: 'Gider guncellendi', metadata: { amount: rows[0].amount, property_id: rows[0].property_id } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const removed = await deleteEntityBelongingToOrganization({ tableName: 'expenses', entityId: req.params.id, organizationId, returningClause: 'id, category, amount, property_id', message: 'Gider bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.EXPENSE_DELETED, entityType: 'expense', entityId: removed.id, title: removed.category, description: 'Gider silindi', metadata: { amount: removed.amount, property_id: removed.property_id } });
    res.json({ success: true, message: 'Gider silindi' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
