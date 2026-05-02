const router = require('express').Router();
const ctrl = require('../controllers/documents.controller');
const { auth } = require('../middleware/auth');
const { requireOrganizationContext, requireWritableOrganization } = require('../middleware/organization');

router.use(auth);
router.use(requireOrganizationContext());
router.get('/', ctrl.list);
router.get('/:id/download', ctrl.download);
router.post('/', requireWritableOrganization(), ctrl.upload.single('file'), ctrl.uploadDocument);
router.delete('/:id', requireWritableOrganization(), ctrl.remove);

module.exports = router;