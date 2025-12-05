const express = require('express');
const router = express.Router();
const { auth, permit } = require('../middlewares/auth.middleware');
const { getSettings, updateSettings } = require('../controllers/setting.controller');

// Hanya ADMIN yang boleh ubah, tapi user boleh baca (jika perlu)
router.get('/', auth, getSettings);
router.put('/', auth, permit('ADMIN'), updateSettings);

module.exports = router;