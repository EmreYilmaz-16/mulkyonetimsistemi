const router = require('express').Router();
const ctrl = require('../controllers/properties.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', requireWritableOrganization(), ctrl.create);
router.put('/:id', requireWritableOrganization(), ctrl.update);
router.delete('/:id', requireWritableOrganization(), ctrl.remove);

module.exports = router;
