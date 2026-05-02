const router = require('express').Router();
const ctrl = require('../controllers/organizations.controller');
const { auth, requireRole } = require('../middleware/auth');
const { requireOrganizationContext, loadTargetOrganization, requireTargetOrganizationAccess } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.use(requireRole('admin', 'platform_admin'));

router.get('/', ctrl.list);
router.get('/plan-requests', requireRole('platform_admin'), ctrl.listPlanRequests);
router.get('/platform-metrics', requireRole('platform_admin'), ctrl.platformMetrics);
router.get('/:id', loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.get);
router.get('/:id/activity', loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.activity);
router.get('/:id/audit', loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.auditLog);
router.get('/:id/audit/export', loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.exportAuditLog);
router.get('/:id/subscription-history', loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.subscriptionHistory);
router.get('/:id/invoices', requireRole('platform_admin'), loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.invoices);
router.post('/:id/plan-request', loadTargetOrganization(), requireTargetOrganizationAccess(), ctrl.requestPlanChange);
router.patch('/:id/admin-credentials', requireRole('platform_admin'), loadTargetOrganization(), ctrl.updateAdminCredentials);
router.patch('/plan-requests/:requestId', requireRole('platform_admin'), ctrl.resolvePlanRequest);
router.patch('/invoices/:invoiceId/status', requireRole('platform_admin'), ctrl.setInvoiceStatus);
router.post('/', requireRole('platform_admin'), ctrl.create);
router.put('/:id', requireRole('platform_admin'), loadTargetOrganization(), ctrl.update);
router.patch('/:id/status', requireRole('platform_admin'), loadTargetOrganization(), ctrl.setStatus);
router.delete('/:id', requireRole('platform_admin'), loadTargetOrganization(), ctrl.remove);

module.exports = router;