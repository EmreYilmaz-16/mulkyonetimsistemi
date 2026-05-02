const router = require('express').Router();
const ctrl = require('../controllers/platform-organizations.controller');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);
router.use(requireRole('platform_admin'));

router.post('/', ctrl.create);
router.patch('/:id/admin-credentials', ctrl.updateAdminCredentials);
router.delete('/:id', ctrl.remove);

module.exports = router;