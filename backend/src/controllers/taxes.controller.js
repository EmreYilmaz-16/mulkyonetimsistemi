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
    const { property_id, tax_type, year, status } = req.query;
    const conditions = ['td.organization_id = $1'];
    const params = [organizationId];
    let i = 2;
    if (property_id) { conditions.push(`td.property_id = $${i++}`); params.push(property_id); }
    if (tax_type)    { conditions.push(`td.tax_type = $${i++}`);    params.push(tax_type); }
    if (year)        { conditions.push(`td.year = $${i++}`);        params.push(Number(year)); }
    if (status)      { conditions.push(`td.status = $${i++}`);      params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT td.*, p.name AS property_name
       FROM tax_declarations td
      LEFT JOIN properties p ON p.id = td.property_id AND p.organization_id = td.organization_id
       ${where}
       ORDER BY td.due_date ASC NULLS LAST, td.year DESC, td.month ASC NULLS LAST`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, tax_type, year, month, amount,
            due_date, paid_date, status, reference_no, notes } = req.body;

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await query(
      `INSERT INTO tax_declarations
         (organization_id, property_id, tax_type, year, month, amount, due_date, paid_date, status, reference_no, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [organizationId, property_id || null, tax_type, year,
       month || null, amount || null,
       due_date || null, paid_date || null,
       status || 'bekliyor', reference_no || null, notes || null]
    );
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.TAX_CREATED, entityType: 'tax_declaration', entityId: rows[0].id, title: rows[0].tax_type, description: `Vergi kaydi eklendi • Durum: ${rows[0].status}`, metadata: { property_id: rows[0].property_id, amount: rows[0].amount } });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, tax_type, year, month, amount,
            due_date, paid_date, status, reference_no, notes } = req.body;

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await query(
      `UPDATE tax_declarations SET
        property_id  = COALESCE($1,  property_id),
        tax_type     = COALESCE($2,  tax_type),
        year         = COALESCE($3,  year),
        month        = COALESCE($4,  month),
        amount       = COALESCE($5,  amount),
        due_date     = COALESCE($6,  due_date),
        paid_date    = COALESCE($7,  paid_date),
        status       = COALESCE($8,  status),
        reference_no = COALESCE($9,  reference_no),
        notes        = COALESCE($10, notes)
       WHERE id = $11 AND organization_id = $12 RETURNING *`,
      [property_id, tax_type, year, month, amount,
       due_date, paid_date, status, reference_no, notes, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Vergi kaydı bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.TAX_UPDATED, entityType: 'tax_declaration', entityId: rows[0].id, title: rows[0].tax_type, description: `Vergi kaydi guncellendi • Durum: ${rows[0].status}`, metadata: { property_id: rows[0].property_id, amount: rows[0].amount } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const removed = await deleteEntityBelongingToOrganization({ tableName: 'tax_declarations', entityId: req.params.id, organizationId, returningClause: 'id, tax_type, amount, property_id', message: 'Vergi kaydı bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.TAX_DELETED, entityType: 'tax_declaration', entityId: removed.id, title: removed.tax_type, description: 'Vergi kaydi silindi', metadata: { property_id: removed.property_id, amount: removed.amount } });
    res.json({ success: true, message: 'Vergi kaydı silindi' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
