const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth.middleware');
const userCtrl = require('../controllers/user.controller');

// dashboard
router.get('/dashboard', auth, userCtrl.getDashboard);

// profile
router.get('/me', auth, userCtrl.getProfile);

// update profile
router.put('/me', auth, userCtrl.updateProfile);

// change password
router.post('/change-password', auth, userCtrl.changePassword);

// get user by id (admin or self)
router.get('/:id', auth, async (req, res, next) => {
	try {
		const id = parseInt(req.params.id);
		const prisma = require('../prismaClient');
		const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
		if (!user) return res.status(404).json({ message: 'User not found' });
		res.json(user);
	} catch (err) { next(err); }
});

module.exports = router;
