const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../services/activity.service');

// Helper: start of day
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// =======================================
// DASHBOARD
// =======================================
const dashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const today = startOfDay(now);

    const totalUsers = await prisma.user.count({
      where: {
        role: {
          name: { not: 'ADMIN' } // admin tidak dihitung
        }
      }
    });

    const presentToday = await prisma.attendance.count({
      where: { date: today }
    });

    const tasksDoneToday = await prisma.task.count({
      where: { status: 'DONE', updatedAt: { gte: today } }
    });

    const reportsToday = await prisma.dailyReport.count({
      where: { date: today }
    });

    res.json({ totalUsers, presentToday, tasksDoneToday, reportsToday });
  } catch (err) {
    next(err);
  }
};

// =======================================
// LIST USERS
// =======================================
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q } = req.query;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = {};

    // search mendukung name, email, position, role
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { position: { contains: q, mode: 'insensitive' } },
        { role: { name: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: { role: true },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.user.count({ where });

    res.json({
      data: users,
      meta: { total, page: parseInt(page), limit: take }
    });
  } catch (err) {
    next(err);
  }
};

// =======================================
// GET USER BY ID
// =======================================
const getUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    next(err);
  }
};

// =======================================
// CREATE USER (FIXED: POSITION & PHONE)
// =======================================
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, position, alamat } = req.body;

    // hash password (kalau kosong, default "password")
    const hashed = await bcrypt.hash(password || 'password', 10);

    // role sistem: default "TENAGA" jika tidak dikirim dari FE
    const roleName = role || 'TENAGA';

    // pastikan role ada di tabel role
    let roleRecord = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!roleRecord) {
      roleRecord = await prisma.role.create({
        data: { name: roleName }
      });
    }

    // buat user baru dengan phone & position disimpan di tabel user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        phone: phone || null,      // ⭐ phone disimpan
        position: position || null,
        alamat: alamat || null,
        roleId: roleRecord.id
      }
    });

    // log aktivitas (non-blocking)
    logActivity(req.user?.userId, 'USER_CREATE', {
      targetUserId: user.id
    }).catch(() => {});

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      position: user.position,
      alamat: user.alamat
    });
  } catch (err) {
    next(err);
  }
};

// =======================================
// UPDATE USER (FIXED: POSITION & PHONE)
// =======================================
const updateUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, password, role, phone, position } = req.body;

    const data = {};

    if (name) data.name = name;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 10);

    // Tambahan phone dan position
    if (phone !== undefined) data.phone = phone;
    if (position !== undefined) data.position = position;

    if (role) {
      let roleRecord = await prisma.role.findUnique({
        where: { name: role }
      });
      if (!roleRecord) {
        roleRecord = await prisma.role.create({
          data: { name: role }
        });
      }
      data.roleId = roleRecord.id;
    }

    const updated = await prisma.user.update({
      where: { id },
      data
    });

    logActivity(req.user?.userId, 'USER_UPDATE', {
      targetUserId: updated.id
    }).catch(() => {});

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      position: updated.position
    });
  } catch (err) {
    next(err);
  }
};

// =======================================
// DELETE USER
// =======================================
const deleteUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.user.delete({ where: { id } });

    logActivity(req.user?.userId, 'USER_DELETE', {
      targetUserId: id
    }).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// =======================================
// LIST TASKS
// =======================================
const listTasks = async (req, res, next) => {
  try {
    const { status, assigneeId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = parseInt(assigneeId);

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: true, createdBy: true },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
};

// =======================================
// UPDATE TASK STATUS
// =======================================
const updateTaskStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const updated = await prisma.task.update({
      where: { id },
      data: { status }
    });

    logActivity(req.user?.userId, 'TASK_UPDATE_STATUS', {
      taskId: updated.id,
      status
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// =======================================
// LIST ACTIVITY LOG
// =======================================
const listActivity = async (req, res, next) => {
  try {
    const { userId, from, to } = req.query;
    const where = {};

    if (userId) where.userId = parseInt(userId);

    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
};

// =======================================
// EXPORT ATTENDANCE (CSV / XLSX)
// =======================================
const exportAttendance = async (req, res, next) => {
  try {
    const { from, to, format } = req.query;

    const where = {};

    if (from || to) where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);

    const rows = await prisma.attendance.findMany({
      where,
      include: { user: true },
      orderBy: { date: 'asc' }
    });

    // EXPORT XLSX
    if (format && format.toLowerCase() === 'xlsx') {
      const ExcelJS = require('exceljs');

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance');

      sheet.columns = [
        { header: 'userId', key: 'userId', width: 10 },
        { header: 'name', key: 'name', width: 30 },
        { header: 'email', key: 'email', width: 30 },
        { header: 'date', key: 'date', width: 25 },
        { header: 'checkIn', key: 'checkIn', width: 25 },
        { header: 'checkOut', key: 'checkOut', width: 25 },
        { header: 'note', key: 'note', width: 40 },
      ];

      for (const r of rows) {
        sheet.addRow({
          userId: r.userId,
          name: r.user?.name || '',
          email: r.user?.email || '',
          date: r.date.toISOString(),
          checkIn: r.checkIn?.toISOString() || '',
          checkOut: r.checkOut?.toISOString() || '',
          note: r.note || ''
        });
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=attendance.xlsx'
      );
      await workbook.xlsx.write(res);
      return res.end();
    }

    // EXPORT CSV
    const header = ['userId', 'name', 'email', 'date', 'checkIn', 'checkOut', 'note'];
    const lines = [header.join(',')];

    for (const r of rows) {
      const line = [
        r.userId,
        `"${(r.user?.name || '').replace(/"/g, '""')}"`,
        r.user?.email || '',
        r.date.toISOString(),
        r.checkIn?.toISOString() || '',
        r.checkOut?.toISOString() || '',
        `"${(r.note || '').replace(/"/g, '""')}"`,
      ].join(',');

      lines.push(line);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=attendance.csv'
    );
    res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
};

// =======================================
// EXPORT MODULE
// =======================================
module.exports = {
  dashboard,
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  listTasks,
  updateTaskStatus,
  listActivity,
  exportAttendance
};
