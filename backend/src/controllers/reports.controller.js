const { query } = require('../config/database');

const dashboard = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    // Vadesi geçmiş pending ödemeleri otomatik late yap
    await query(`UPDATE payments SET status = 'late' WHERE organization_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE`, [organizationId]);

    const [
      propertyStats, paymentStats, contractStats, upcomingContracts, overduePayments, recentPayments, maintenanceOpen
    ] = await Promise.all([
      query(`SELECT
               COUNT(*) FILTER (WHERE status = 'available') AS available,
               COUNT(*) FILTER (WHERE status = 'rented') AS rented,
               COUNT(*) FILTER (WHERE status = 'for_sale') AS for_sale,
               COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance,
               COUNT(*) FILTER (WHERE type = 'residential') AS residential,
               COUNT(*) FILTER (WHERE type = 'commercial') AS commercial,
               COUNT(*) FILTER (WHERE type = 'parking') AS parking,
               COUNT(*) FILTER (WHERE type = 'other') AS other,
               COUNT(*) AS total
               FROM properties WHERE organization_id = $1`, [organizationId]),
      query(`SELECT
               COALESCE(SUM(amount) FILTER (WHERE status = 'paid'
                 AND date_trunc('month', payment_date) = date_trunc('month', NOW())), 0) AS collected_this_month,
               COALESCE(SUM(amount) FILTER (WHERE status != 'cancelled'
                 AND date_trunc('month', due_date) = date_trunc('month', NOW())), 0) AS due_this_month,
               COALESCE(SUM(amount) FILTER (WHERE status IN ('late','pending') AND due_date < CURRENT_DATE), 0) AS overdue_total,
               COUNT(*) FILTER (WHERE status IN ('late','pending') AND due_date < CURRENT_DATE) AS overdue_count,
               COALESCE(SUM(amount) FILTER (WHERE status = 'pending'
                 AND date_trunc('month', due_date) = date_trunc('month', NOW())), 0) AS pending_this_month
             FROM payments WHERE organization_id = $1`, [organizationId]),
      query(`SELECT
               COUNT(*) FILTER (WHERE status = 'active' AND end_date >= CURRENT_DATE) AS active,
               COUNT(*) FILTER (WHERE status = 'expired' OR (status = 'active' AND end_date < CURRENT_DATE)) AS expired,
               COUNT(*) FILTER (WHERE status = 'active'
                 AND end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 months')) AS expiring_3_months,
               COUNT(*) FILTER (WHERE status = 'active'
                 AND end_date BETWEEN NOW()::date AND (NOW() + INTERVAL '30 days')::date) AS expiring_soon
             FROM contracts WHERE organization_id = $1`, [organizationId]),
      query(`SELECT c.id, c.end_date, c.monthly_rent,
                    p.name AS property_name,
                    t.first_name || ' ' || t.last_name AS tenant_name, t.phone
             FROM contracts c
             JOIN properties p ON p.id = c.property_id
             JOIN tenants t ON t.id = c.tenant_id
             WHERE c.organization_id = $1
               AND c.status = 'active'
               AND c.end_date BETWEEN NOW()::date AND (NOW() + INTERVAL '60 days')::date
             ORDER BY c.end_date LIMIT 5`, [organizationId]),
      query(`SELECT py.id, py.amount, py.due_date, py.status,
                    pr.name AS property_name,
                    t.first_name || ' ' || t.last_name AS tenant_name,
                    t.phone
             FROM payments py
             JOIN contracts c ON c.id = py.contract_id
             JOIN properties pr ON pr.id = c.property_id
             JOIN tenants t ON t.id = c.tenant_id
             WHERE py.organization_id = $1 AND py.status IN ('late','pending') AND py.due_date < CURRENT_DATE
             ORDER BY py.due_date ASC LIMIT 10`, [organizationId]),
      query(`SELECT py.id, py.amount, py.due_date, py.status, py.payment_date,
                    pr.name AS property_name,
                    t.first_name || ' ' || t.last_name AS tenant_name
             FROM payments py
             JOIN contracts c ON c.id = py.contract_id
             JOIN properties pr ON pr.id = c.property_id
             JOIN tenants t ON t.id = c.tenant_id
                  WHERE py.organization_id = $1 AND py.status = 'paid'
                  ORDER BY py.payment_date DESC LIMIT 5`, [organizationId]),
      query(`SELECT COUNT(*) AS count FROM maintenance_requests
                  WHERE organization_id = $1 AND status IN ('open','in_progress')`, [organizationId])
    ]);

    res.json({
      success: true,
      data: {
        properties: propertyStats.rows[0],
        payments: paymentStats.rows[0],
        contracts: contractStats.rows[0],
        expiring_contracts: upcomingContracts.rows,
        overdue_payments: overduePayments.rows,
        recent_payments: recentPayments.rows,
        open_maintenance: Number(maintenanceOpen.rows[0].count)
      }
    });
  } catch (err) { next(err); }
};

const incomeExpense = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { year = new Date().getFullYear() } = req.query;

    const [income, expenses] = await Promise.all([
      query(`SELECT
               to_char(date_trunc('month', payment_date), 'YYYY-MM') AS month,
               SUM(amount) AS total
             FROM payments
             WHERE status = 'paid'
               AND organization_id = $2
               AND EXTRACT(YEAR FROM payment_date) = $1
             GROUP BY 1 ORDER BY 1`, [year, organizationId]),
      query(`SELECT
               to_char(date_trunc('month', date), 'YYYY-MM') AS month,
               SUM(amount) AS total
             FROM expenses
             WHERE EXTRACT(YEAR FROM date) = $1
               AND organization_id = $2
             GROUP BY 1 ORDER BY 1`, [year, organizationId])
    ]);

    res.json({ success: true, data: { income: income.rows, expenses: expenses.rows, year: Number(year) } });
  } catch (err) { next(err); }
};

const propertyProfitability = async (req, res, next) => {
  try {
    const organizationId = req.organizationId;
    const { year = new Date().getFullYear(), site_name } = req.query;
    const conditions = [`p.organization_id = $2`];
    const params = [year, organizationId];

    if (site_name) {
      conditions.push(`p.site_name ILIKE $3`);
      params.push(`%${site_name}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT p.id,
              p.name,
              p.site_name,
              p.unit_number,
              COALESCE(pi.income, 0) AS income,
              COALESCE(pe.expenses, 0) AS expenses,
              COALESCE(pi.income, 0) - COALESCE(pe.expenses, 0) AS net
       FROM properties p
       LEFT JOIN (
         SELECT c.property_id,
                SUM(py.amount) AS income
         FROM contracts c
         JOIN payments py ON py.contract_id = c.id
         WHERE py.status = 'paid'
           AND c.organization_id = $2
           AND EXTRACT(YEAR FROM py.payment_date) = $1
         GROUP BY c.property_id
       ) pi ON pi.property_id = p.id
       LEFT JOIN (
         SELECT e.property_id,
                SUM(e.amount) AS expenses
         FROM expenses e
         WHERE EXTRACT(YEAR FROM e.date) = $1
           AND e.organization_id = $2
         GROUP BY e.property_id
       ) pe ON pe.property_id = p.id
       ${where}
       ORDER BY net DESC`, params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { dashboard, incomeExpense, propertyProfitability };
