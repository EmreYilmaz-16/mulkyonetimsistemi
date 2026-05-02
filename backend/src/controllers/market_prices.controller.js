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
    const { property_id, price_type } = req.query;
    const conditions = ['mp.organization_id = $1'];
    const params = [organizationId];
    let i = 2;
    if (property_id) { conditions.push(`mp.property_id = $${i++}`); params.push(property_id); }
    if (price_type)  { conditions.push(`mp.price_type = $${i++}`);  params.push(price_type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT mp.*,
              p.name AS property_name,
              (SELECT c.monthly_rent
               FROM contracts c
                     WHERE c.property_id = p.id AND c.organization_id = mp.organization_id AND c.status = 'active'
               ORDER BY c.created_at DESC LIMIT 1) AS current_rent
       FROM market_prices mp
                   LEFT JOIN properties p ON p.id = mp.property_id AND p.organization_id = mp.organization_id
       ${where}
       ORDER BY mp.noted_date DESC, mp.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, price_type, amount, source, url, noted_date, notes } = req.body;

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await query(
      `INSERT INTO market_prices (organization_id, property_id, price_type, amount, source, url, noted_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [organizationId, property_id || null, price_type, amount,
       source || null, url || null,
       noted_date || new Date().toISOString().split('T')[0],
       notes || null]
    );
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.MARKET_PRICE_CREATED, entityType: 'market_price', entityId: rows[0].id, title: rows[0].price_type, description: `Fiyat kaydi eklendi • Tutar: ${rows[0].amount}`, metadata: { property_id: rows[0].property_id, amount: rows[0].amount } });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { property_id, price_type, amount, source, url, noted_date, notes } = req.body;

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await query(
      `UPDATE market_prices SET
        property_id = COALESCE($1, property_id),
        price_type  = COALESCE($2, price_type),
        amount      = COALESCE($3, amount),
        source      = COALESCE($4, source),
        url         = COALESCE($5, url),
        noted_date  = COALESCE($6, noted_date),
        notes       = COALESCE($7, notes)
       WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [property_id, price_type, amount, source, url, noted_date, notes, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Fiyat kaydı bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.MARKET_PRICE_UPDATED, entityType: 'market_price', entityId: rows[0].id, title: rows[0].price_type, description: 'Fiyat kaydi guncellendi', metadata: { property_id: rows[0].property_id, amount: rows[0].amount } });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const removed = await deleteEntityBelongingToOrganization({ tableName: 'market_prices', entityId: req.params.id, organizationId, returningClause: 'id, price_type, amount, property_id', message: 'Fiyat kaydı bulunamadı' });
    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.MARKET_PRICE_DELETED, entityType: 'market_price', entityId: removed.id, title: removed.price_type, description: 'Fiyat kaydi silindi', metadata: { property_id: removed.property_id, amount: removed.amount } });
    res.json({ success: true, message: 'Fiyat kaydı silindi' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
