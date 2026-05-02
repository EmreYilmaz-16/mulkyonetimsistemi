const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureEntityBelongsToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const list = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    // Vadesi geçmiş pending ödemeleri otomatik "late" yap
    await query(
      `UPDATE payments SET status = 'late'
       WHERE organization_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE`,
      [organizationId]
    );

    const {
      status,
      overdue,
      contract_id,
      tenant_name,
      site_name,
      from_date,
      to_date,
      page = 1,
      limit = 20
    } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [`p.organization_id = $1`];
    const params = [organizationId];
    let i = 2;

    if (overdue === 'true') {
      conditions.push(`p.status IN ('late','pending')`);
      conditions.push(`p.due_date < CURRENT_DATE`);
    } else if (status) {
      conditions.push(`p.status = $${i++}`);
      params.push(status);
    }
    if (contract_id) { conditions.push(`p.contract_id = $${i++}`); params.push(contract_id); }
    if (tenant_name) {
      conditions.push(`(t.first_name || ' ' || t.last_name) ILIKE $${i++}`);
      params.push(`%${tenant_name}%`);
    }
    if (site_name) {
      conditions.push(`COALESCE(pr.site_name, '') ILIKE $${i++}`);
      params.push(`%${site_name}%`);
    }
    if (from_date)   { conditions.push(`p.due_date >= $${i++}`); params.push(from_date); }
    if (to_date)     { conditions.push(`p.due_date <= $${i++}`); params.push(to_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseFrom = `
      FROM payments p
      JOIN contracts c ON c.id = p.contract_id
      JOIN properties pr ON pr.id = c.property_id
      JOIN tenants t ON t.id = c.tenant_id
    `;

    const countRes = await query(`SELECT COUNT(*) ${baseFrom} ${where}`, params);
    const { rows } = await query(
      `SELECT p.*,
              pr.name AS property_name,
              pr.site_name,
              t.id AS tenant_id,
              t.first_name || ' ' || t.last_name AS tenant_name
       ${baseFrom}
       ${where}
       ORDER BY p.due_date DESC
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
    const { contract_id, amount, due_date, payment_date, status, method, reference_no, notes } = req.body;

    await ensureEntityBelongsToOrganization({
      tableName: 'contracts',
      entityId: contract_id,
      organizationId,
      message: 'Sozlesme bulunamadi'
    });

    const { rows } = await query(
      `INSERT INTO payments (organization_id, contract_id, amount, due_date, payment_date, status, method, reference_no, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [organizationId, contract_id, amount, due_date, payment_date || null,
       status || 'pending', method || null, reference_no || null, notes || null]
    );
    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.PAYMENT_RECORDED,
      entityType: 'payment',
      entityId: rows[0].id,
      title: `Odeme #${rows[0].id.slice(0, 8)}`,
      description: `Durum: ${rows[0].status} • Tutar: ${rows[0].amount}`,
      metadata: { amount: rows[0].amount, status: rows[0].status, contract_id }
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const markPaid = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { payment_date, method, reference_no, notes } = req.body;
    const { rows } = await query(
      `UPDATE payments SET
        status = 'paid',
        payment_date = COALESCE($1, NOW()::date),
        method = COALESCE($2, method),
        reference_no = COALESCE($3, reference_no),
        notes = COALESCE($4, notes)
       WHERE id = $5 AND organization_id = $6 RETURNING *`,
      [payment_date, method, reference_no, notes, req.params.id, organizationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ödeme bulunamadı' });
    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.PAYMENT_MARKED_PAID,
      entityType: 'payment',
      entityId: rows[0].id,
      title: `Odeme #${rows[0].id.slice(0, 8)}`,
      description: `Odeme tahsil edildi • Tutar: ${rows[0].amount}`,
      metadata: { amount: rows[0].amount, method: rows[0].method, status: rows[0].status }
    });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

const generateMonthly = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    // Aktif sözleşmeler için belirtilen ay/yıl'da tahakkuk oluştur
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ success: false, message: 'year ve month gerekli' });

    const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    // Ayın son günü — bu ayda başlayan sözleşmeleri de kapsar
    const lastOfMonth  = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const { rows: contracts } = await query(
      `SELECT id, monthly_rent, COALESCE(payment_day, 1) AS payment_day FROM contracts
       WHERE organization_id = $3
         AND status = 'active'
         AND start_date <= $2::date
         AND end_date   >= $1::date`,
      [firstOfMonth, lastOfMonth, organizationId]
    );

    let created = 0;
    for (const c of contracts) {
      // Ödeme günü: sözleşmedeki payment_day (1-28), ayda o kadar gün yoksa son güne kırp
      const daysInMonth = new Date(year, month, 0).getDate();
      const day = Math.min(Number(c.payment_day), daysInMonth);
      const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const exists = await query(
        `SELECT id FROM payments WHERE contract_id = $1 AND organization_id = $2
         AND date_trunc('month', due_date) = date_trunc('month', $3::date)` ,
        [c.id, organizationId, dueDate]
      );
      if (!exists.rows.length) {
        await query(
          `INSERT INTO payments (organization_id, contract_id, amount, due_date, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [organizationId, c.id, c.monthly_rent, dueDate]
        );
        await recordOrganizationAuditEvent({
          organizationId,
          actorUserId: req.user?.id || null,
          eventType: AUDIT_EVENT_TYPES.PAYMENT_RECORDED,
          entityType: 'payment',
          entityId: null,
          title: `Aylik tahakkuk • Sozlesme #${c.id.slice(0, 8)}`,
          description: `Tutar: ${c.monthly_rent} • Vade: ${dueDate}`,
          metadata: { amount: c.monthly_rent, contract_id: c.id, due_date: dueDate, generated: true }
        });
        created++;
      }
    }

    res.json({ success: true, message: `${created} ödeme tahakkuku oluşturuldu` });
  } catch (err) { next(err); }
};

module.exports = { list, create, markPaid, generateMonthly };
