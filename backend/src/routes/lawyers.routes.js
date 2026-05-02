const router = require('express').Router();
const ctrl = require('../controllers/lawyers.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());

// Avukat CRUD
router.get('/lawyers', ctrl.listLawyers);
router.get('/lawyers/:id', ctrl.getLawyer);
router.post('/lawyers', requireWritableOrganization(), ctrl.createLawyer);
router.put('/lawyers/:id', requireWritableOrganization(), ctrl.updateLawyer);
router.delete('/lawyers/:id', requireWritableOrganization(), ctrl.removeLawyer);

// Dava CRUD
router.get('/cases', ctrl.listCases);
router.post('/cases', requireWritableOrganization(), ctrl.createCase);
router.put('/cases/:id', requireWritableOrganization(), ctrl.updateCase);
router.delete('/cases/:id', requireWritableOrganization(), ctrl.removeCase);

module.exports = router;
