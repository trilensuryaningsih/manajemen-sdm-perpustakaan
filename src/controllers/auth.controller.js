const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../services/activity.service');

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    // find role id
    let roleRecord = await prisma.role.findUnique({ where: { name: role || 'TENAGA' }});
    if (!roleRecord) {
      roleRecord = await prisma.role.create({ data: { name: role || 'TENAGA' }});
    }
    const user = await prisma.user.create({
      data: { name, email, password: hashed, roleId: roleRecord.id },
    });
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true }});
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const payload = { userId: user.id, role: user.role.name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    // log login activity (non-blocking)
    logActivity(user.id, 'LOGIN', { ip: req.ip }).catch?.(() => {});
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role.name }});
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login };
