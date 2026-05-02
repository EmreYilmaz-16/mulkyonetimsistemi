const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.get('/dashboard', ctrl.dashboard);
router.get('/income-expense', ctrl.incomeExpense);
router.get('/profitability', ctrl.propertyProfitability);

module.exports = router;
