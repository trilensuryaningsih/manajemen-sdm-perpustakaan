const prisma = require('../prismaClient');
const { logActivity } = require('../services/activity.service');

const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // prevent duplicate check-in same date
    const existing = await prisma.attendance.findFirst({
      where: { userId, date: dateOnly }
    });
    if (existing) return res.status(400).json({ message: 'Sudah check-in hari ini' });

    const att = await prisma.attendance.create({ data: { userId, date: dateOnly, checkIn: now } });
    // log activity
    logActivity(userId, 'ATTENDANCE_CHECKIN', { attendanceId: att.id }).catch?.(() => {});
    res.status(201).json(att);
  } catch (err) { next(err); }
};

const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const existing = await prisma.attendance.findFirst({ where: { userId, date: dateOnly }});
    if (!existing) return res.status(400).json({ message: 'Belum check-in hari ini' });
    const updated = await prisma.attendance.update({ where: { id: existing.id }, data: { checkOut: now, note: req.body.note || null } });
    logActivity(userId, 'ATTENDANCE_CHECKOUT', { attendanceId: updated.id }).catch?.(() => {});
    res.json(updated);
  } catch (err) { next(err); }
};

const getHistory = async (req, res, next) => {
  try {
    const { userId, from, to } = req.query;
    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (from || to) where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
    const data = await prisma.attendance.findMany({ where, include: { user: true }, orderBy: { date: 'desc' }});
    res.json(data);
  } catch (err) { next(err); }
};

module.exports = { checkIn, checkOut, getHistory };
