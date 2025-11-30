const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

const getProfile = async (req, res, next) => {
	try {
		const id = req.user?.userId;
		const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
		if (!user) return res.status(404).json({ message: 'User not found' });
		res.json({ id: user.id, name: user.name, email: user.email, role: user.role.name, position: user.position, phone: user.phone, createdAt: user.createdAt });
	} catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
	try {
		const userId = req.user?.userId;
		const { oldPassword, newPassword } = req.body;
		if (!oldPassword || !newPassword) return res.status(400).json({ message: 'oldPassword and newPassword are required' });
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user) return res.status(404).json({ message: 'User not found' });
		const ok = await bcrypt.compare(oldPassword, user.password);
		if (!ok) return res.status(400).json({ message: 'Old password is incorrect' });
		const hashed = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
		res.json({ message: 'Password updated' });
	} catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
	try {
		const userId = req.user?.userId;
		const { name, email } = req.body;
		const data = {};
		if (name) data.name = name;
		if (email) data.email = email;
		const updated = await prisma.user.update({ where: { id: userId }, data });
		res.json({ id: updated.id, name: updated.name, email: updated.email });
	} catch (err) { next(err); }
};

module.exports = { getProfile, changePassword, updateProfile };
