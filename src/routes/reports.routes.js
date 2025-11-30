const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth.middleware');
const reportCtrl = require('../controllers/report.controller');
const multer = require('multer');
const path = require('path');

// setup multer storage to ./uploads
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, path.join(__dirname, '..', '..', 'uploads'));
	},
	filename: function (req, file, cb) {
		const unique = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
		const name = unique + '-' + file.originalname.replace(/\s+/g, '_');
		cb(null, name);
	}
});

const upload = multer({ storage });

// list daily reports (authenticated)
router.get('/', auth, reportCtrl.listReports);

// create daily report (user) - supports file uploads (field name: attachments)
router.post('/', auth, upload.array('attachments', 10), reportCtrl.createReport);

module.exports = router;
