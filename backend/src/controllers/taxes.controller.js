const { query, getClient } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  ensureOptionalEntityBelongsToOrganization,
  deleteEntityBelongingToOrganization,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const TAX_TYPE_LABELS = Object.freeze({
  gmsi: 'GMSI – Kira Geliri Beyannamesi',
  emlak_1: 'Emlak Vergisi – 1. Taksit',
  emlak_2: 'Emlak Vergisi – 2. Taksit',
  dask: 'DASK – Zorunlu Deprem Sigortasi',
  konut_sigorta: 'Konut Sigortasi',
  stopaj: 'Stopaj (Ticari Kira)',
  kdv: 'KDV (Ticari Kira)',
  diger: 'Diger'
});

const TAX_TYPE_EXPENSE_CATEGORY = Object.freeze({
  dask: 'dask',
  konut_sigorta: 'insurance'
});

const buildTaxExpenseDescription = (taxRow) => `Vergi odemesi — ${(TAX_TYPE_LABELS[taxRow.tax_type] || taxRow.tax_type)} #${taxRow.id.slice(0, 8)}`;

const syncTaxExpense = async ({ client, organizationId, taxRow, actorUserId, db }) => {
  const amount = Number(taxRow.amount) || 0;
  const description = buildTaxExpenseDescription(taxRow);
  const category = TAX_TYPE_EXPENSE_CATEGORY[taxRow.tax_type] || 'tax';
  const effectiveDate = taxRow.paid_date || new Date().toISOString().split('T')[0];
  const shouldExist = taxRow.status === 'odendi' && amount > 0;

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
        title: category,
        description: 'Vergi odemesi gider kaydi kaldirildi',
        metadata: { amount: existingExpense.amount, property_id: existingExpense.property_id, source: 'tax_declaration', tax_declaration_id: taxRow.id },
        db
      });
    }
    return;
  }

  if (existingExpense) {
    await client.query(
      `UPDATE expenses SET
         property_id = $1,
         category = $2,
         amount = $3,
         date = $4,
         description = $5,
         updated_at = NOW()
       WHERE id = $6 AND organization_id = $7`,
      [taxRow.property_id || null, category, amount, effectiveDate, description, existingExpense.id, organizationId]
    );

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId,
      eventType: AUDIT_EVENT_TYPES.EXPENSE_UPDATED,
      entityType: 'expense',
      entityId: existingExpense.id,
      title: category,
      description: `Vergi odemesi gideri guncellendi • Tutar: ${amount}`,
      metadata: { amount, property_id: taxRow.property_id, source: 'tax_declaration', tax_declaration_id: taxRow.id },
      db
    });
    return;
  }

  const { rows: expenseRows } = await client.query(
    `INSERT INTO expenses (organization_id, property_id, category, amount, date, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [organizationId, taxRow.property_id || null, category, amount, effectiveDate, description]
  );

  await recordOrganizationAuditEvent({
    organizationId,
    actorUserId,
    eventType: AUDIT_EVENT_TYPES.EXPENSE_CREATED,
    entityType: 'expense',
    entityId: expenseRows[0].id,
    title: category,
    description: `Vergi odemesi gideri eklendi • Tutar: ${amount}`,
    metadata: { amount, property_id: taxRow.property_id, source: 'tax_declaration', tax_declaration_id: taxRow.id },
    db
  });
};

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
  const client = await getClient();
  try {
    const organizationId = req.organizationId;
    const db = client.query.bind(client);
    const { property_id, tax_type, year, month, amount,
            due_date, paid_date, status, reference_no, notes } = req.body;

    await client.query('BEGIN');

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: property_id, organizationId, message: 'Mulk bulunamadi' });

    const effectiveStatus = status || 'bekliyor';
    const effectivePaidDate = effectiveStatus === 'odendi'
      ? (paid_date || new Date().toISOString().split('T')[0])
      : (paid_date || null);

    const { rows } = await client.query(
      `INSERT INTO tax_declarations
         (organization_id, property_id, tax_type, year, month, amount, due_date, paid_date, status, reference_no, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [organizationId, property_id || null, tax_type, year,
       month || null, amount || null,
       due_date || null, effectivePaidDate,
       effectiveStatus, reference_no || null, notes || null]
    );

    await syncTaxExpense({ client, organizationId, taxRow: rows[0], actorUserId: req.user?.id || null, db });

    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.TAX_CREATED, entityType: 'tax_declaration', entityId: rows[0].id, title: rows[0].tax_type, description: `Vergi kaydi eklendi • Durum: ${rows[0].status}`, metadata: { property_id: rows[0].property_id, amount: rows[0].amount }, db });

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
    const { property_id, tax_type, year, month, amount,
            due_date, paid_date, status, reference_no, notes } = req.body;

    await client.query('BEGIN');

    const { rows: existingRows } = await client.query(
      'SELECT * FROM tax_declarations WHERE id = $1 AND organization_id = $2',
      [req.params.id, organizationId]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vergi kaydı bulunamadı' });
    }

    const existing = existingRows[0];
    const nextPropertyId = property_id === undefined ? existing.property_id : (property_id || null);
    const nextTaxType = tax_type ?? existing.tax_type;
    const nextYear = year ?? existing.year;
    const nextMonth = month === undefined ? existing.month : (month || null);
    const nextAmount = amount === undefined ? existing.amount : (amount || null);
    const nextDueDate = due_date === undefined ? existing.due_date : (due_date || null);
    const nextStatus = status ?? existing.status;
    const nextPaidDate = nextStatus === 'odendi'
      ? (paid_date || existing.paid_date || new Date().toISOString().split('T')[0])
      : (paid_date === undefined ? existing.paid_date : (paid_date || null));
    const nextReferenceNo = reference_no === undefined ? existing.reference_no : (reference_no || null);
    const nextNotes = notes === undefined ? existing.notes : (notes || null);

    await ensureOptionalEntityBelongsToOrganization({ tableName: 'properties', entityId: nextPropertyId, organizationId, message: 'Mulk bulunamadi' });

    const { rows } = await client.query(
      `UPDATE tax_declarations SET
        property_id  = $1,
        tax_type     = $2,
        year         = $3,
        month        = $4,
        amount       = $5,
        due_date     = $6,
        paid_date    = $7,
        status       = $8,
        reference_no = $9,
        notes        = $10,
        updated_at   = NOW()
       WHERE id = $11 AND organization_id = $12 RETURNING *`,
      [nextPropertyId, nextTaxType, nextYear, nextMonth, nextAmount,
       nextDueDate, nextPaidDate, nextStatus, nextReferenceNo, nextNotes, req.params.id, organizationId]
    );

    await syncTaxExpense({ client, organizationId, taxRow: rows[0], actorUserId: req.user?.id || null, db });

    await recordOrganizationAuditEvent({ organizationId, actorUserId: req.user?.id || null, eventType: AUDIT_EVENT_TYPES.TAX_UPDATED, entityType: 'tax_declaration', entityId: rows[0].id, title: rows[0].tax_type, description: `Vergi kaydi guncellendi • Durum: ${rows[0].status}`, metadata: { property_id: rows[0].property_id, amount: rows[0].amount }, db });

    await client.query('COMMIT');
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
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
