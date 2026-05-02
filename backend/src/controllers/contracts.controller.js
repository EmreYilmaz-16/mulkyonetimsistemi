const { query, getClient } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntitiesBelongToOrganization,
  ensureEntityBelongsToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const PAYMENT_TYPES = Object.freeze({
  RENT: 'rent',
  DEPOSIT: 'deposit'
});

const normalizeNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const normalizeNullableInteger = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const upsertDepositAccrual = async ({ client, organizationId, contractId, depositAmount, dueDate, actorUserId, db }) => {
  const normalizedDepositAmount = Number(depositAmount) || 0;

  const { rows: existingRows } = await client.query(
    `SELECT id, status
     FROM payments
     WHERE contract_id = $1 AND organization_id = $2 AND payment_type = $3
     ORDER BY created_at ASC
     LIMIT 1`,
    [contractId, organizationId, PAYMENT_TYPES.DEPOSIT]
  );

  const existing = existingRows[0];

  if (normalizedDepositAmount <= 0) {
    if (existing && ['pending', 'late', 'partial'].includes(existing.status)) {
      await client.query(
        `UPDATE payments
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [existing.id, organizationId]
      );
    }
    return;
  }

  if (existing) {
    if (['pending', 'late', 'partial'].includes(existing.status)) {
      await client.query(
        `UPDATE payments
         SET amount = $1,
             due_date = $2,
             notes = $3,
             updated_at = NOW()
         WHERE id = $4 AND organization_id = $5`,
        [normalizedDepositAmount, dueDate, 'Depozito tahakkuku', existing.id, organizationId]
      );
    }
    return;
  }

  const { rows: paymentRows } = await client.query(
    `INSERT INTO payments (organization_id, contract_id, payment_type, amount, due_date, status, notes)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING *`,
    [organizationId, contractId, PAYMENT_TYPES.DEPOSIT, normalizedDepositAmount, dueDate, 'Depozito tahakkuku']
  );

  await recordOrganizationAuditEvent({
    organizationId,
    actorUserId,
    eventType: AUDIT_EVENT_TYPES.PAYMENT_RECORDED,
    entityType: 'payment',
    entityId: paymentRows[0].id,
    title: `Depozito tahakkuku #${contractId.slice(0, 8)}`,
    description: `Tutar: ${paymentRows[0].amount} • Vade: ${dueDate}`,
    metadata: { amount: paymentRows[0].amount, contract_id: contractId, payment_type: PAYMENT_TYPES.DEPOSIT, generated: true },
    db
  });
};

const list = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { status, property_id, tenant_id, expiry_filter, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [`c.organization_id = $1`];
    const params = [organizationId];
    let i = 2;

    if (status)      { conditions.push(`c.status = $${i++}`); params.push(status); }
    if (property_id) { conditions.push(`c.property_id = $${i++}`); params.push(property_id); }
    if (tenant_id)   { conditions.push(`c.tenant_id = $${i++}`); params.push(tenant_id); }
    if (expiry_filter === 'expired') {
      conditions.push(`((c.status = 'expired') OR (c.status = 'active' AND c.end_date < CURRENT_DATE))`);
    }
    if (expiry_filter === 'expiring_3_months') {
      conditions.push(`c.status = 'active' AND c.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 months')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM contracts c ${where}`, params);
    const { rows } = await query(
      `SELECT c.*,
              p.name AS property_name, p.unit_number,
              t.first_name || ' ' || t.last_name AS tenant_name, t.phone AS tenant_phone
       FROM contracts c
       JOIN properties p ON p.id = c.property_id
      JOIN tenants t ON t.id = c.tenant_id AND t.organization_id = c.organization_id
       ${where}
       ORDER BY c.start_date DESC
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
      `SELECT c.*,
              p.name AS property_name, p.unit_number,
              t.first_name || ' ' || t.last_name AS tenant_name,
              t.phone AS tenant_phone, t.email AS tenant_email
       FROM contracts c
       JOIN properties p ON p.id = c.property_id
       JOIN tenants t ON t.id = c.tenant_id AND t.organization_id = c.organization_id
       WHERE c.id = $1 AND c.organization_id = $2`, [req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });

    const { rows: payments } = await query(
      'SELECT * FROM payments WHERE contract_id = $1 AND organization_id = $2 ORDER BY due_date DESC',
      [req.params.id, organizationId]
    );

    res.json({ success: true, data: { ...rows[0], payments } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  const client = await getClient();
  try {
    const organizationId = req.organizationId;
    const db = client.query.bind(client);
    await client.query('BEGIN');
    const { property_id, tenant_id, start_date, end_date, monthly_rent,
            deposit_amount, increase_type, increase_rate, special_terms, eviction_date,
            payment_day } = req.body;
    const safeDepositAmount = Math.max(0, normalizeNullableNumber(deposit_amount) || 0);
    const safePaymentDay = normalizeNullableInteger(payment_day) || 1;

    // Çakışan aktif sözleşme kontrolü
    const conflict = await client.query(
      `SELECT id FROM contracts
       WHERE property_id = $1 AND organization_id = $4 AND status = 'active'
         AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
      [property_id, start_date, end_date, organizationId]
    );
    if (conflict.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Bu mülk için çakışan aktif sözleşme var' });
    }

    await ensureEntitiesBelongToOrganization({
      organizationId,
      db,
      entities: [
        { tableName: 'properties', entityId: property_id, message: 'Mulk bulunamadi' },
        { tableName: 'tenants', entityId: tenant_id, message: 'Kiraci bulunamadi' }
      ]
    });

    const { rows } = await client.query(
      `INSERT INTO contracts (organization_id, property_id, tenant_id, start_date, end_date, monthly_rent,
        deposit_amount, increase_type, increase_rate, special_terms, eviction_date, payment_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [organizationId, property_id, tenant_id, start_date, end_date, monthly_rent,
       safeDepositAmount, increase_type || 'tüfe', increase_rate || null,
       special_terms || null, eviction_date || null, safePaymentDay]
    );

    await upsertDepositAccrual({
      client,
      organizationId,
      contractId: rows[0].id,
      depositAmount: rows[0].deposit_amount,
      dueDate: rows[0].start_date,
      actorUserId: req.user?.id || null,
      db
    });

    // Mülk durumunu "rented" yap
    await client.query(`UPDATE properties SET status = 'rented' WHERE id = $1 AND organization_id = $2`, [property_id, organizationId]);

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.CONTRACT_CREATED,
      entityType: 'contract',
      entityId: rows[0].id,
      title: `Sozlesme #${rows[0].id.slice(0, 8)}`,
      description: `Aylik kira: ${rows[0].monthly_rent}`,
      metadata: { property_id, tenant_id, monthly_rent: rows[0].monthly_rent },
      occurredAt: rows[0].created_at,
      db
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const update = async (req, res, next) => {
  const client = await getClient();
  try {
    const organizationId = req.organizationId;
    const db = client.query.bind(client);
    const { end_date, monthly_rent, deposit_amount, increase_type,
            increase_rate, special_terms, eviction_date, status, payment_day } = req.body;
    await client.query('BEGIN');
    const normalizedDepositAmount = normalizeNullableNumber(deposit_amount);
    const normalizedPaymentDay = normalizeNullableInteger(payment_day);
    const { rows } = await client.query(
      `UPDATE contracts SET
        end_date = COALESCE($1, end_date),
        monthly_rent = COALESCE($2, monthly_rent),
        deposit_amount = COALESCE($3, deposit_amount),
        increase_type = COALESCE($4, increase_type),
        increase_rate = COALESCE($5, increase_rate),
        special_terms = COALESCE($6, special_terms),
        eviction_date = COALESCE($7, eviction_date),
        status = COALESCE($8, status),
        payment_day = COALESCE($9, payment_day)
       WHERE id = $10 AND organization_id = $11 RETURNING *`,
      [end_date, monthly_rent, normalizedDepositAmount, increase_type,
       increase_rate, special_terms, eviction_date, status, normalizedPaymentDay, req.params.id, organizationId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });
    }

    if (normalizedDepositAmount !== null) {
      await upsertDepositAccrual({
        client,
        organizationId,
        contractId: rows[0].id,
        depositAmount: rows[0].deposit_amount,
        dueDate: rows[0].start_date,
        actorUserId: req.user?.id || null,
        db
      });
    }

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.CONTRACT_UPDATED,
      entityType: 'contract',
      entityId: rows[0].id,
      title: `Sozlesme #${rows[0].id.slice(0, 8)}`,
      description: 'Sozlesme guncellendi',
      metadata: { status: rows[0].status, monthly_rent: rows[0].monthly_rent },
      db
    });

    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// Sözleşmeyi sonlandır: status güncelle + mülkü "available" yap + depozito iadesini gider kaydet
const terminate = async (req, res, next) => {
  const client = await getClient();
  try {
    const organizationId = req.organizationId;
    const db = client.query.bind(client);
    await client.query('BEGIN');

    const {
      termination_type = 'terminated',
      deposit_return_amount = null,   // null = tam iade, 0 = hiç iade yok, X = kısmi iade
      deposit_return_date,
      termination_notes
    } = req.body;
    const safeReturnDate  = deposit_return_date  || null;
    const safeNotes       = termination_notes    || null;

    // Sözleşmeyi getir
    const { rows: existing } = await client.query(
      'SELECT * FROM contracts WHERE id = $1 AND organization_id = $2', [req.params.id, organizationId]
    );
    if (!existing.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });
    }
    if (existing[0].status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Sadece aktif sözleşmeler sonlandırılabilir' });
    }

    const depositAmount  = Number(existing[0].deposit_amount) || 0;
    const normalizedReturnAmount = deposit_return_amount === '' || deposit_return_amount === undefined
      ? null
      : normalizeNullableNumber(deposit_return_amount);
    if (normalizedReturnAmount !== null && (normalizedReturnAmount < 0 || normalizedReturnAmount > depositAmount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Depozito iade tutari gecersiz' });
    }

    const returnAmount   = normalizedReturnAmount !== null ? normalizedReturnAmount : depositAmount;
    const depositReturned = returnAmount >= depositAmount;
    const effectiveReturnDate = returnAmount > 0
      ? (safeReturnDate || new Date().toISOString().split('T')[0])
      : null;

    // Sözleşmeyi güncelle
    const { rows } = await client.query(
      `UPDATE contracts SET
         status = $1,
         deposit_returned = $2,
         deposit_return_date = $3,
         deposit_return_amount = $4,
         termination_notes = $5,
         updated_at = NOW()
       WHERE id = $6 AND organization_id = $7 RETURNING *`,
      [termination_type, depositReturned, effectiveReturnDate, returnAmount, safeNotes, req.params.id, organizationId]
    );

    if (returnAmount > 0) {
      await client.query(
        `INSERT INTO expenses (organization_id, property_id, category, amount, date, description)
         VALUES ($1, $2, 'other', $3, $4, $5)`,
        [organizationId, existing[0].property_id, returnAmount, effectiveReturnDate,
         `Depozito iadesi — sözleşme #${req.params.id.slice(0, 8)}`]
      );

      await recordOrganizationAuditEvent({
        organizationId,
        actorUserId: req.user?.id || null,
        eventType: AUDIT_EVENT_TYPES.EXPENSE_CREATED,
        entityType: 'expense',
        entityId: null,
        title: `Depozito iadesi #${req.params.id.slice(0, 8)}`,
        description: `Iade tutari: ${returnAmount}`,
        metadata: { amount: returnAmount, contract_id: req.params.id, auto_generated: true },
        occurredAt: effectiveReturnDate,
        db
      });
    }

    // Mülkü boşa çıkar
    await client.query(
      `UPDATE properties SET status = 'available', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [existing[0].property_id, organizationId]
    );

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.CONTRACT_TERMINATED,
      entityType: 'contract',
      entityId: rows[0].id,
      title: `Sozlesme #${rows[0].id.slice(0, 8)}`,
      description: 'Sozlesme sonlandirildi',
      metadata: { termination_type, deposit_return_amount: returnAmount, deposit_retained_amount: Math.max(0, depositAmount - returnAmount) },
      db
    });

    await client.query('COMMIT');
    res.json({
      success: true,
      data: rows[0],
      message: returnAmount > 0
        ? `Sözleşme sonlandırıldı. ₺${returnAmount.toLocaleString('tr-TR')} depozito iadesi gider olarak kaydedildi.`
        : 'Sözleşme sonlandırıldı.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = { list, get, create, update, terminate };
