const router = require('express').Router();
const ctrl = require('../controllers/contracts.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requireWritableOrganization(), ctrl.create);
router.put('/:id', requireWritableOrganization(), ctrl.update);
router.post('/:id/terminate', requireWritableOrganization(), ctrl.terminate);

module.exports = router;
