(function () {
	const express = require('express');
	const router = express.Router();
	const { auth } = require('../middlewares/auth.middleware');
	const { checkIn, checkOut, getHistory } = require('../controllers/attendance.controller');

	router.post('/checkin', auth, checkIn);
	router.post('/checkout', auth, checkOut);
	router.get('/history', auth, getHistory);

	module.exports = router;
})();

