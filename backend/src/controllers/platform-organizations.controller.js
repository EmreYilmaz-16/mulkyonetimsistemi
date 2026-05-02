const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');

const VALID_PLANS = new Set(['starter', 'pro', 'enterprise']);

const normalizeSlug = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 160);

const create = async (req, res, next) => {
  const client = await getClient();

  try {
    const name = String(req.body.name || '').trim();
    const slug = normalizeSlug(req.body.slug || req.body.name || '');
    const adminName = String(req.body.admin_name || '').trim();
    const adminEmail = String(req.body.admin_email || '').trim().toLowerCase();
    const adminPassword = String(req.body.admin_password || '');
    const subscriptionPlan = VALID_PLANS.has(req.body.subscription_plan) ? req.body.subscription_plan : 'starter';
    const maxUsers = Math.max(Number(req.body.max_users || 0) || 0, 1);
    const maxProperties = Math.max(Number(req.body.max_properties || 0) || 0, 1);
    const contactEmail = String(req.body.contact_email || '').trim() || null;
    const contactPhone = String(req.body.contact_phone || '').trim() || null;
    const adminPhone = String(req.body.admin_phone || '').trim() || null;
    const isActive = req.body.is_active !== false;
    const trialEndsAt = req.body.trial_ends_at ? new Date(req.body.trial_ends_at).toISOString() : null;

    if (!name || !slug || !adminName || !adminEmail || adminPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Organizasyon ve ilk admin bilgileri eksik veya geçersiz' });
    }

    await client.query('BEGIN');

    const organizationInsert = await client.query(
      `INSERT INTO organizations (
        name,
        slug,
        contact_email,
        contact_phone,
        subscription_plan,
        max_users,
        max_properties,
        is_active,
        trial_ends_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        name,
        slug,
        contactEmail,
        contactPhone,
        subscriptionPlan,
        maxUsers,
        maxProperties,
        isActive,
        trialEndsAt
      ]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const userInsert = await client.query(
      `INSERT INTO users (
        organization_id,
        name,
        email,
        password,
        role,
        phone
      ) VALUES ($1,$2,$3,$4,'admin',$5)
      RETURNING id, organization_id, name, email, role, phone, is_active, created_at`,
      [organizationInsert.rows[0].id, adminName, adminEmail, passwordHash, adminPhone]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        ...organizationInsert.rows[0],
        admin_user: userInsert.rows[0]
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Slug veya admin e-postası zaten kullanımda' });
    }
    return next(error);
  } finally {
    client.release();
  }
};

const updateAdminCredentials = async (req, res, next) => {
  const organizationId = String(req.params.id || '').trim();
  const currentEmail = String(req.body.current_email || '').trim().toLowerCase();
  const nextEmail = req.body.admin_email === undefined
    ? null
    : (String(req.body.admin_email || '').trim().toLowerCase() || null);
  const nextPassword = req.body.admin_password === undefined
    ? null
    : String(req.body.admin_password || '');

  if (!organizationId) {
    return res.status(400).json({ success: false, message: 'Organizasyon kimliği gerekli' });
  }

  if (!currentEmail && !nextEmail) {
    return res.status(400).json({ success: false, message: 'Güncellenecek admin e-postası gerekli' });
  }

  if (nextPassword !== null && nextPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Admin şifresi en az 8 karakter olmalı' });
  }

  if (nextEmail === null && nextPassword === null) {
    return res.status(400).json({ success: false, message: 'Güncellenecek admin bilgisi bulunamadı' });
  }

  const updates = [];
  const values = [];

  if (nextEmail !== null) {
    values.push(nextEmail);
    updates.push(`email = $${values.length}`);
  }

  if (nextPassword !== null) {
    const passwordHash = await bcrypt.hash(nextPassword, 12);
    values.push(passwordHash);
    updates.push(`password = $${values.length}`);
  }

  values.push(organizationId);
  const organizationIndex = values.length;
  values.push(currentEmail || nextEmail);
  const emailIndex = values.length;

  try {
    const { rows } = await query(
      `UPDATE users
          SET ${updates.join(', ')},
              updated_at = NOW()
        WHERE id = (
          SELECT id
          FROM users
          WHERE organization_id = $${organizationIndex}
            AND role = 'admin'
            AND email = $${emailIndex}
          ORDER BY created_at ASC
          LIMIT 1
        )
        RETURNING id, organization_id, name, email, role, phone, is_active, created_at, updated_at`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Güncellenecek tenant admin kullanıcısı bulunamadı' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Admin e-postası zaten kullanımda' });
    }
    return next(error);
  }
};

const remove = async (req, res, next) => {
  const organizationId = String(req.params.id || '').trim();
  if (!organizationId) {
    return res.status(400).json({ success: false, message: 'Organizasyon kimliği gerekli' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users WHERE organization_id = $1', [organizationId]);
    const deleted = await client.query('DELETE FROM organizations WHERE id = $1 RETURNING id, name, slug', [organizationId]);
    await client.query('COMMIT');

    if (!deleted.rows.length) {
      return res.status(404).json({ success: false, message: 'Organizasyon bulunamadı' });
    }

    return res.json({ success: true, data: deleted.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
};

module.exports = { create, updateAdminCredentials, remove };