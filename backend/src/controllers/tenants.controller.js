const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntityBelongsToOrganization,
  deleteEntityBelongingToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const list = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { search, is_active, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [`organization_id = $1`];
    const params = [organizationId];
    let i = 2;

    if (is_active !== undefined) { conditions.push(`is_active = $${i++}`); params.push(is_active === 'true'); }
    if (search) {
      conditions.push(`(first_name ILIKE $${i} OR last_name ILIKE $${i} OR phone ILIKE $${i} OR email ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM tenants ${where}`, params);
    const { rows } = await query(
      `SELECT tenants.*,
              (
                SELECT COUNT(*)
                FROM contracts c
                WHERE c.tenant_id = tenants.id AND c.status = 'active' AND c.organization_id = tenants.organization_id
              )::int AS active_contract_count
       FROM tenants ${where}
       ORDER BY last_name, first_name LIMIT $${i++} OFFSET $${i++}`,
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
    const { rows } = await query('SELECT * FROM tenants WHERE id = $1 AND organization_id = $2', [req.params.id, organizationId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kiracı bulunamadı' });

    const { rows: contracts } = await query(
      `SELECT c.*, p.name AS property_name FROM contracts c
       JOIN properties p ON p.id = c.property_id
       WHERE c.tenant_id = $1 AND c.organization_id = $2 ORDER BY c.start_date DESC`,
      [req.params.id, organizationId]
    );

    res.json({ success: true, data: { ...rows[0], contracts } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { first_name, last_name, tc_no, phone, email,
            emergency_contact, emergency_phone, findeks_score, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO tenants (organization_id, first_name, last_name, tc_no, phone, email,
        emergency_contact, emergency_phone, findeks_score, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [organizationId, first_name, last_name, tc_no || null, phone, email || null,
       emergency_contact || null, emergency_phone || null,
       findeks_score || null, notes || null]
    );
    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.TENANT_CREATED,
      entityType: 'tenant',
      entityId: rows[0].id,
      title: `${rows[0].first_name} ${rows[0].last_name}`,
      description: 'Kiraci olusturuldu',
      metadata: { phone: rows[0].phone, is_active: rows[0].is_active }
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { first_name, last_name, tc_no, phone, email,
            emergency_contact, emergency_phone, findeks_score, notes, is_active } = req.body;
    const { rows } = await query(
      `UPDATE tenants SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        tc_no = COALESCE($3, tc_no),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        emergency_contact = COALESCE($6, emergency_contact),
        emergency_phone = COALESCE($7, emergency_phone),
        findeks_score = COALESCE($8, findeks_score),
        notes = COALESCE($9, notes),
        is_active = COALESCE($10, is_active)
       WHERE id = $11 AND organization_id = $12 RETURNING *`,
      [first_name, last_name, tc_no, phone, email,
       emergency_contact, emergency_phone, findeks_score, notes, is_active, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kiracı bulunamadı' });
    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.TENANT_UPDATED,
      entityType: 'tenant',
      entityId: rows[0].id,
      title: `${rows[0].first_name} ${rows[0].last_name}`,
      description: 'Kiraci guncellendi',
      metadata: { is_active: rows[0].is_active }
    });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const tenant = await ensureEntityBelongsToOrganization({
      tableName: 'tenants',
      entityId: req.params.id,
      organizationId,
      selectClause: 'id, first_name, last_name, is_active',
      message: 'Kiracı bulunamadı'
    });
    await deleteEntityBelongingToOrganization({ tableName: 'tenants', entityId: req.params.id, organizationId, message: 'Kiracı bulunamadı' });
    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.TENANT_DELETED,
      entityType: 'tenant',
      entityId: tenant.id,
      title: `${tenant.first_name} ${tenant.last_name}`,
      description: 'Kiraci silindi',
      metadata: { is_active: tenant.is_active }
    });
    res.json({ success: true, message: 'Kiracı silindi' });
  } catch (err) { next(err); }
};

module.exports = { list, get, create, update, remove };
