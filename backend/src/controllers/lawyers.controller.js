const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntitiesBelongToOrganization,
  ensureOptionalEntityBelongsToOrganization,
  deleteEntityBelongingToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

// ─── AVUKAT CRUD ─────────────────────────────────────────────
const listLawyers = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { rows } = await query(
      `SELECT * FROM lawyers WHERE organization_id = $1 ORDER BY name ASC`,
      [organizationId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getLawyer = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { rows } = await query('SELECT * FROM lawyers WHERE id = $1 AND organization_id = $2', [req.params.id, organizationId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Avukat bulunamadı' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const createLawyer = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { name, phone, email, specialty, bar_no, firm, hourly_rate, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO lawyers (organization_id, name, phone, email, specialty, bar_no, firm, hourly_rate, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [organizationId, name, phone || null, email || null, specialty || null,
       bar_no || null, firm || null, hourly_rate || null, notes || null]
    );
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.LAWYER_CREATED, entityType: 'lawyer', entityId: rows[0].id, title: rows[0].name, description: 'Avukat olusturuldu', metadata: { specialty: rows[0].specialty, firm: rows[0].firm } });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const updateLawyer = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { name, phone, email, specialty, bar_no, firm, hourly_rate, notes, is_active } = req.body;
    const { rows } = await query(
      `UPDATE lawyers SET
        name        = COALESCE($1, name),
        phone       = COALESCE($2, phone),
        email       = COALESCE($3, email),
        specialty   = COALESCE($4, specialty),
        bar_no      = COALESCE($5, bar_no),
        firm        = COALESCE($6, firm),
        hourly_rate = COALESCE($7, hourly_rate),
        notes       = COALESCE($8, notes),
        is_active   = COALESCE($9, is_active)
       WHERE id = $10 AND organization_id = $11 RETURNING *`,
      [name, phone, email, specialty, bar_no, firm, hourly_rate, notes, is_active, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Avukat bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.LAWYER_UPDATED, entityType: 'lawyer', entityId: rows[0].id, title: rows[0].name, description: 'Avukat guncellendi', metadata: { specialty: rows[0].specialty, is_active: rows[0].is_active } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const removeLawyer = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const removed = await deleteEntityBelongingToOrganization({ tableName: 'lawyers', entityId: req.params.id, organizationId, returningClause: 'id, name, specialty', message: 'Avukat bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.LAWYER_DELETED, entityType: 'lawyer', entityId: removed.id, title: removed.name, description: 'Avukat silindi', metadata: { specialty: removed.specialty } });
    res.json({ success: true, message: 'Avukat silindi' });
  } catch (err) { next(err); }
};

// ─── DAVA CRUD ────────────────────────────────────────────────
const listCases = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { lawyer_id, property_id, status } = req.query;
    const conditions = ['lc.organization_id = $1'];
    const params = [organizationId];
    let i = 2;
    if (lawyer_id)   { conditions.push(`lc.lawyer_id = $${i++}`);   params.push(lawyer_id); }
    if (property_id) { conditions.push(`lc.property_id = $${i++}`); params.push(property_id); }
    if (status)      { conditions.push(`lc.status = $${i++}`);      params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT lc.*,
              l.name AS lawyer_name,
              p.name AS property_name,
              t.first_name || ' ' || t.last_name AS tenant_name
       FROM legal_cases lc
      LEFT JOIN lawyers    l ON l.id = lc.lawyer_id AND l.organization_id = lc.organization_id
      LEFT JOIN properties p ON p.id = lc.property_id AND p.organization_id = lc.organization_id
      LEFT JOIN tenants    t ON t.id = lc.tenant_id AND t.organization_id = lc.organization_id
       ${where}
       ORDER BY lc.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createCase = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { lawyer_id, property_id, tenant_id, case_type, title,
            court, case_no, status, filing_date, next_hearing, fee, description } = req.body;

    await ensureEntitiesBelongToOrganization({ organizationId, entities: [
      { tableName: 'lawyers', entityId: lawyer_id, message: 'Avukat bulunamadi' },
      { tableName: 'properties', entityId: property_id, message: 'Mulk bulunamadi' },
      { tableName: 'tenants', entityId: tenant_id, message: 'Kiraci bulunamadi' }
    ] });

    const { rows } = await query(
      `INSERT INTO legal_cases
         (organization_id, lawyer_id, property_id, tenant_id, case_type, title,
          court, case_no, status, filing_date, next_hearing, fee, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [organizationId, lawyer_id || null, property_id || null, tenant_id || null,
       case_type, title, court || null, case_no || null,
       status || 'devam_ediyor', filing_date || null, next_hearing || null,
       fee || 0, description || null]
    );
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.LEGAL_CASE_CREATED, entityType: 'legal_case', entityId: rows[0].id, title: rows[0].title, description: `Dava olusturuldu • Durum: ${rows[0].status}`, metadata: { case_type: rows[0].case_type, lawyer_id: rows[0].lawyer_id } });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const updateCase = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { lawyer_id, property_id, tenant_id, case_type, title,
            court, case_no, status, filing_date, next_hearing, fee, description, result } = req.body;

    await ensureEntitiesBelongToOrganization({ organizationId, entities: [
      { tableName: 'lawyers', entityId: lawyer_id, message: 'Avukat bulunamadi' },
      { tableName: 'properties', entityId: property_id, message: 'Mulk bulunamadi' },
      { tableName: 'tenants', entityId: tenant_id, message: 'Kiraci bulunamadi' }
    ] });

    const { rows } = await query(
      `UPDATE legal_cases SET
        lawyer_id    = COALESCE($1,  lawyer_id),
        property_id  = COALESCE($2,  property_id),
        tenant_id    = COALESCE($3,  tenant_id),
        case_type    = COALESCE($4,  case_type),
        title        = COALESCE($5,  title),
        court        = COALESCE($6,  court),
        case_no      = COALESCE($7,  case_no),
        status       = COALESCE($8,  status),
        filing_date  = COALESCE($9,  filing_date),
        next_hearing = COALESCE($10, next_hearing),
        fee          = COALESCE($11, fee),
        description  = COALESCE($12, description),
        result       = COALESCE($13, result)
       WHERE id = $14 AND organization_id = $15 RETURNING *`,
      [lawyer_id, property_id, tenant_id, case_type, title,
       court, case_no, status, filing_date, next_hearing, fee, description, result,
       req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Dava bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.LEGAL_CASE_UPDATED, entityType: 'legal_case', entityId: rows[0].id, title: rows[0].title, description: `Dava guncellendi • Durum: ${rows[0].status}`, metadata: { case_type: rows[0].case_type, lawyer_id: rows[0].lawyer_id } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const removeCase = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const removed = await deleteEntityBelongingToOrganization({ tableName: 'legal_cases', entityId: req.params.id, organizationId, returningClause: 'id, title, case_type', message: 'Dava bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.LEGAL_CASE_DELETED, entityType: 'legal_case', entityId: removed.id, title: removed.title, description: 'Dava silindi', metadata: { case_type: removed.case_type } });
    res.json({ success: true, message: 'Dava silindi' });
  } catch (err) { next(err); }
};

module.exports = {
  listLawyers, getLawyer, createLawyer, updateLawyer, removeLawyer,
  listCases, createCase, updateCase, removeCase
};
