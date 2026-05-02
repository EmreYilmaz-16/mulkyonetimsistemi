const {
  requireOrganizationId,
  getOrganization,
  assertOrganizationWritable,
  createAppError
} = require('../utils/organization');

const requireOrganizationContext = () => async (req, _res, next) => {
  try {
    const organizationId = requireOrganizationId(req);
    const organization = await getOrganization(organizationId);
    req.organizationId = organization.id;
    req.organization = organization;
    next();
  } catch (err) {
    next(err);
  }
};

const requireWritableOrganization = () => async (req, _res, next) => {
  try {
    const organization = req.organization || await getOrganization(requireOrganizationId(req));
    assertOrganizationWritable(organization);
    req.organizationId = organization.id;
    req.organization = organization;
    next();
  } catch (err) {
    next(err);
  }
};

const loadTargetOrganization = (paramKey = 'id') => async (req, _res, next) => {
  try {
    const targetOrganizationId = req.params[paramKey];
    if (!targetOrganizationId) {
      throw createAppError('Organizasyon bilgisi bulunamadi', 400);
    }

    req.targetOrganization = await getOrganization(targetOrganizationId);
    next();
  } catch (err) {
    next(err);
  }
};

const requireTargetOrganizationAccess = () => (req, res, next) => {
  if (req.user?.role === 'platform_admin') {
    return next();
  }

  if (req.targetOrganization?.id !== req.organizationId) {
    return res.status(403).json({ success: false, message: 'Sadece kendi organizasyonunuza erisebilirsiniz' });
  }

  next();
};

module.exports = {
  requireOrganizationContext,
  requireWritableOrganization,
  loadTargetOrganization,
  requireTargetOrganizationAccess
};