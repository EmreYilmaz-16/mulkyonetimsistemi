const router = require('express').Router();
const ctrl = require('../controllers/payments.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.get('/', ctrl.list);
router.post('/', requireWritableOrganization(), ctrl.create);
router.post('/generate-monthly', requireWritableOrganization(), ctrl.generateMonthly);
router.put('/:id/mark-paid', requireWritableOrganization(), ctrl.markPaid);

module.exports = router;
