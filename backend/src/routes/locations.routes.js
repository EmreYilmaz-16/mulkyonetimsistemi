const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getCities, getDistricts } = require('../controllers/locations.controller');

router.get('/cities',    auth, getCities);
router.get('/districts', auth, getDistricts);

module.exports = router;
