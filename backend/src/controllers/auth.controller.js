const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { AUDIT_EVENT_TYPES } = require('../utils/organizationAudit');
const {
  assertOrganizationLimit,
  recordOrganizationAuditEvent
} = require('../utils/organization');

const VALID_ROLES = ['owner', 'accountant', 'agent', 'admin', 'platform_admin'];

const getManagedUser = async (req, userId) => {
  const organizationId = req.organizationId || req.user?.organization_id;
  const { rows } = await query(
    `SELECT id,
            organization_id,
            name,
            email,
            role,
            phone,
            is_active,
            created_at,
            updated_at
       FROM users
      WHERE id = $1
        AND organization_id = $2`,
    [userId, organizationId]
  );

  if (!rows.length) {
    return null;
  }

  if (req.user?.role !== 'platform_admin' && rows[0].role === 'platform_admin') {
    return null;
  }

  return rows[0];
};

const assertLastAdminSafety = async (organizationId, targetUser, nextIsActive) => {
  if (targetUser.role !== 'admin' || nextIsActive) {
    return;
  }

  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM users
      WHERE organization_id = $1
        AND role = 'admin'
        AND is_active = TRUE
        AND id <> $2`,
    [organizationId, targetUser.id]
  );

  if (!rows[0]?.total) {
    const error = new Error('Son aktif admin pasife alınamaz');
    error.status = 400;
    throw error;
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email ve şifre gerekli' });
    }

    const { rows } = await query(
      `SELECT u.id,
              u.organization_id,
              u.name,
              u.email,
              u.password,
              u.role,
              o.name AS organization_name,
              o.slug AS organization_slug,
              o.is_active AS organization_active,
              o.subscription_plan,
              o.max_users,
              o.max_properties,
              o.trial_ends_at
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1 AND u.is_active = TRUE`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Geçersiz kimlik bilgileri' });
    }

    const user = rows[0];
    if (!user.organization_active) {
      return res.status(403).json({ success: false, message: 'Organizasyon hesabı pasif durumda' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Geçersiz kimlik bilgileri' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        organization_slug: user.organization_slug,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          organization_id: user.organization_id,
          organization_name: user.organization_name,
          organization_slug: user.organization_slug,
          subscription_plan: user.subscription_plan,
          max_users: user.max_users,
          max_properties: user.max_properties,
          trial_ends_at: user.trial_ends_at,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const organizationId = req.organizationId || req.user?.organization_id;
    const hidePlatformAdmins = req.user?.role !== 'platform_admin';
    const { rows } = await query(
      `SELECT u.id,
              u.organization_id,
              u.name,
              u.email,
              u.role,
              u.phone,
              u.is_active,
              u.created_at,
              o.max_users,
              (SELECT COUNT(*)::int FROM users listed WHERE listed.organization_id = u.organization_id AND listed.role <> 'platform_admin') AS user_count
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.organization_id = $1
         AND ($2::boolean = FALSE OR u.role <> 'platform_admin')
       ORDER BY u.created_at DESC`,
      [organizationId, hidePlatformAdmins]
    );

    const maxUsers = rows[0]?.max_users || 0;
    const userCount = rows[0]?.user_count || 0;

    res.json({
      success: true,
      data: rows.map(({ max_users, user_count, ...user }) => user),
      summary: {
        user_count: userCount,
        max_users: maxUsers,
        remaining_slots: Math.max(maxUsers - userCount, 0)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Sadece admin rolüdeki kullanıcılar yeni kullanıcı oluşturabilir
const register = async (req, res, next) => {
  try {
    const organizationId = req.organizationId || req.organization?.id;
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Ad, email ve şifre zorunlu' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Şifre en az 8 karakter olmalı' });
    }
    if (role === 'platform_admin' && req.user?.role !== 'platform_admin') {
      return res.status(403).json({ success: false, message: 'Platform admin rolünü sadece super admin atayabilir' });
    }
    const assignedRole = VALID_ROLES.includes(role) ? role : 'owner';

    await assertOrganizationLimit(organizationId, 'users');

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (organization_id, name, email, password, role, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, organization_id, name, email, role, phone, created_at`,
      [organizationId, name.trim(), email.toLowerCase().trim(), hash, assignedRole, phone || null]
    );

    await recordOrganizationAuditEvent({
      organizationId,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.USER_CREATED,
      entityType: 'user',
      entityId: rows[0].id,
      title: rows[0].name,
      description: `Kullanici eklendi: ${rows[0].email}`,
      metadata: { role: rows[0].role, email: rows[0].email }
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id,
              u.organization_id,
              u.name,
              u.email,
              u.role,
              u.phone,
              u.created_at,
              o.name AS organization_name,
              o.slug AS organization_slug,
              o.subscription_plan,
              o.max_users,
              o.max_properties,
              o.is_active,
              o.trial_ends_at
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Geçerli mevcut şifre ve en az 8 karakterli yeni şifre gerekli' });
    }

    const { rows } = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Mevcut şifre yanlış' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    await recordOrganizationAuditEvent({
      organizationId: req.organizationId || req.user.organization_id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: req.user.id,
      title: req.user.name || 'Kullanici',
      description: 'Sifre guncellendi',
      metadata: { email: req.user.email }
    });
    res.json({ success: true, message: 'Şifre güncellendi' });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const targetUser = await getManagedUser(req, req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }

    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const phone = req.body.phone?.trim() || null;
    const requestedRole = req.body.role;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Ad ve e-posta zorunlu' });
    }

    if (requestedRole === 'platform_admin' && req.user?.role !== 'platform_admin') {
      return res.status(403).json({ success: false, message: 'Platform admin rolünü sadece super admin atayabilir' });
    }

    const role = VALID_ROLES.includes(requestedRole) ? requestedRole : targetUser.role;

    await assertLastAdminSafety(targetUser.organization_id, targetUser, true);

    const { rows } = await query(
      `UPDATE users
          SET name = $1,
              email = $2,
              phone = $3,
              role = $4,
              updated_at = NOW()
        WHERE id = $5
        RETURNING id, organization_id, name, email, role, phone, is_active, created_at, updated_at`,
      [name, email, phone, role, targetUser.id]
    );

    await recordOrganizationAuditEvent({
      organizationId: targetUser.organization_id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.USER_UPDATED,
      entityType: 'user',
      entityId: targetUser.id,
      title: rows[0].name,
      description: `Kullanici guncellendi: ${rows[0].email}`,
      metadata: {
        previous_name: targetUser.name,
        previous_email: targetUser.email,
        previous_role: targetUser.role,
        role: rows[0].role,
        email: rows[0].email
      }
    });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const setUserStatus = async (req, res, next) => {
  try {
    const targetUser = await getManagedUser(req, req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }

    const isActive = req.body.is_active === true || req.body.is_active === 'true';

    if (targetUser.id === req.user?.id && !isActive) {
      return res.status(400).json({ success: false, message: 'Kendi hesabınızı pasife alamazsınız' });
    }

    await assertLastAdminSafety(targetUser.organization_id, targetUser, isActive);

    const { rows } = await query(
      `UPDATE users
          SET is_active = $1,
              updated_at = NOW()
        WHERE id = $2
        RETURNING id, organization_id, name, email, role, phone, is_active, created_at, updated_at`,
      [isActive, targetUser.id]
    );

    await recordOrganizationAuditEvent({
      organizationId: targetUser.organization_id,
      actorUserId: req.user?.id || null,
      eventType: isActive ? AUDIT_EVENT_TYPES.USER_ACTIVATED : AUDIT_EVENT_TYPES.USER_DEACTIVATED,
      entityType: 'user',
      entityId: targetUser.id,
      title: rows[0].name,
      description: isActive ? `Kullanici aktife alindi: ${rows[0].email}` : `Kullanici pasife alindi: ${rows[0].email}`,
      metadata: { email: rows[0].email, role: rows[0].role, is_active: rows[0].is_active }
    });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const targetUser = await getManagedUser(req, req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }

    const newPassword = req.body.newPassword || '';
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Yeni şifre en az 8 karakter olmalı' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, targetUser.id]);

    await recordOrganizationAuditEvent({
      organizationId: targetUser.organization_id,
      actorUserId: req.user?.id || null,
      eventType: AUDIT_EVENT_TYPES.PASSWORD_CHANGED,
      entityType: 'user',
      entityId: targetUser.id,
      title: targetUser.name,
      description: `Kullanici sifresi admin tarafindan sifirlandi: ${targetUser.email}`,
      metadata: { email: targetUser.email, reset_by_admin: true }
    });

    res.json({ success: true, message: 'Şifre sıfırlandı' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, listUsers, register, me, changePassword, updateUser, setUserStatus, resetUserPassword };
