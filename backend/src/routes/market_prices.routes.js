const router = require('express').Router();
const ctrl = require('../controllers/market_prices.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.get('/', ctrl.list);
router.post('/', requireWritableOrganization(), ctrl.create);
router.put('/:id', requireWritableOrganization(), ctrl.update);
router.delete('/:id', requireWritableOrganization(), ctrl.remove);

module.exports = router;
