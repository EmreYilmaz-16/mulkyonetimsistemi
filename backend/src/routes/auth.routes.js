const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { auth, requireRole } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.post('/login', ctrl.login);
router.get('/users', auth, requireRole('admin', 'platform_admin'), requireOrganizationContext(), ctrl.listUsers);
// Yeni kullanıcı sadece admin tarafından oluşturulabilir
router.post('/register', auth, requireRole('admin', 'platform_admin'), requireOrganizationContext(), requireWritableOrganization(), ctrl.register);
router.put('/users/:userId', auth, requireRole('admin', 'platform_admin'), requireOrganizationContext(), requireWritableOrganization(), ctrl.updateUser);
router.patch('/users/:userId/status', auth, requireRole('admin', 'platform_admin'), requireOrganizationContext(), requireWritableOrganization(), ctrl.setUserStatus);
router.put('/users/:userId/reset-password', auth, requireRole('admin', 'platform_admin'), requireOrganizationContext(), requireWritableOrganization(), ctrl.resetUserPassword);
router.get('/me', auth, ctrl.me);
router.put('/change-password', auth, requireOrganizationContext(), requireWritableOrganization(), ctrl.changePassword);

module.exports = router;
