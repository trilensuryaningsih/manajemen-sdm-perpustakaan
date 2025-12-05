const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../services/activity.service');
const PDFDocument = require('pdfkit'); 
const ExcelJS = require('exceljs');

// Helper: start of day
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// =======================================
// 1. DASHBOARD
// =======================================
const dashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const totalKaryawan = await prisma.user.count({
      where: { role: { name: { not: 'ADMIN' } } }
    });

    const karyawanAktifHariIni = await prisma.attendance.count({
      where: { date: { gte: today, lt: endOfToday } }
    });

    const laporanHarian = await prisma.dailyReport.count({
      where: { date: { gte: today, lt: endOfToday } }
    });

    const tingkatKehadiran = totalKaryawan > 0 
      ? Math.round((karyawanAktifHariIni / totalKaryawan) * 100) 
      : 0;

    const absensiHariIni = await prisma.attendance.findMany({
      where: { date: { gte: today, lt: endOfToday } },
      include: { user: { select: { id: true, name: true, position: true, email: true } } },
      orderBy: { checkIn: 'asc' }
    });

    const tugasTerbaru = await prisma.task.findMany({
      take: 10,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      karyawanAktifHariIni,
      laporanHarian,
      tingkatKehadiran,
      totalKaryawan,
      absensiHariIni,
      tugasTerbaru
    });
  } catch (err) {
    next(err);
  }
};

// =======================================
// 2. EXPORT ATTENDANCE (PDF & EXCEL)
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

    // --- EXPORT PDF ---
    if (format && format.toLowerCase() === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Absensi.pdf');
        doc.pipe(res);

        // Judul
        doc.fontSize(16).text('Laporan Rekap Absensi', { align: 'center' });
        doc.fontSize(10).text(`Periode: ${from || '-'} s/d ${to || '-'}`, { align: 'center' });
        doc.moveDown(2);

        // Table Config
        let y = doc.y;
        const xName = 30;
        const xDate = 180;
        const xIn = 280;
        const xOut = 360;
        const xStatus = 450;

        // Header
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Nama', xName, y);
        doc.text('Tanggal', xDate, y);
        doc.text('Masuk', xIn, y);
        doc.text('Pulang', xOut, y);
        doc.text('Status', xStatus, y);
        
        y += 15;
        doc.moveTo(30, y).lineTo(565, y).stroke();
        y += 10;

        // Rows
        doc.font('Helvetica').fontSize(9);
        rows.forEach(r => {
            if (y > 750) { 
                doc.addPage(); 
                y = 50; 
            }
            
            const dateStr = r.date.toISOString().split('T')[0];
            const inStr = r.checkIn ? new Date(r.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
            const outStr = r.checkOut ? new Date(r.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
            const status = r.statusAbsen ? r.statusAbsen.replace(/_/g, ' ') : '-';

            doc.text(r.user?.name || 'User', xName, y, { width: 140, lineBreak: false });
            doc.text(dateStr, xDate, y);
            doc.text(inStr, xIn, y);
            doc.text(outStr, xOut, y);
            doc.text(status, xStatus, y);
            
            y += 20;
        });

        doc.end();
        return;
    }

    // --- EXPORT EXCEL ---
    if (format && format.toLowerCase() === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Absensi');

      sheet.columns = [
        { header: 'Nama', key: 'name', width: 30 },
        { header: 'Tanggal', key: 'date', width: 15 },
        { header: 'Jam Masuk', key: 'checkIn', width: 15 },
        { header: 'Jam Pulang', key: 'checkOut', width: 15 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Catatan', key: 'note', width: 30 },
      ];

      rows.forEach(r => {
        sheet.addRow({
          name: r.user?.name || '',
          date: r.date.toISOString().split('T')[0],
          checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
          checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
          status: r.statusAbsen || '-',
          note: r.note || ''
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Absensi.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    res.status(400).json({ message: 'Format tidak didukung (pilih pdf atau xlsx)' });
  } catch (err) {
    console.error("Export Error:", err);
    next(err);
  }
};

// =======================================
// 3. EXPORT TASK COMPLETION (PDF & EXCEL)
// =======================================
const exportTaskCompletion = async (req, res, next) => {
  try {
    const { format } = req.query;

    // Ambil data user non-admin
    const users = await prisma.user.findMany({
        where: { role: { name: { not: 'ADMIN' } } },
        select: { id: true, name: true }
    });

    const data = [];
    for (const user of users) {
        const total = await prisma.task.count({ where: { assigneeId: user.id } });
        const selesai = await prisma.task.count({ where: { assigneeId: user.id, status: 'SELESAI' } });
        const active = total - selesai;
        const percent = total > 0 ? Math.round((selesai / total) * 100) : 0;
        
        data.push({ name: user.name, total, selesai, active, percent });
    }

    // --- EXPORT PDF ---
    if (format && format.toLowerCase() === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Tugas.pdf');
        doc.pipe(res);

        doc.fontSize(16).text('Laporan Penyelesaian Tugas', { align: 'center' });
        doc.moveDown(2);

        let y = doc.y;
        const xName = 50;
        const xTotal = 250;
        const xDone = 320;
        const xActive = 390;
        const xPercent = 460;

        // Header
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Nama Karyawan', xName, y);
        doc.text('Total', xTotal, y);
        doc.text('Selesai', xDone, y);
        doc.text('Aktif', xActive, y);
        doc.text('(%)', xPercent, y);

        y += 15;
        doc.moveTo(50, y).lineTo(500, y).stroke();
        y += 10;

        // Rows
        doc.font('Helvetica').fontSize(9);
        data.forEach(r => {
             if (y > 750) { 
                 doc.addPage(); 
                 y = 50; 
             }
             doc.text(r.name, xName, y);
             doc.text(r.total.toString(), xTotal, y);
             doc.text(r.selesai.toString(), xDone, y);
             doc.text(r.active.toString(), xActive, y);
             doc.text(r.percent + '%', xPercent, y);
             y += 15;
        });

        doc.end();
        return;
    }

    // --- EXPORT EXCEL ---
    if (format && format.toLowerCase() === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Tugas');

        sheet.columns = [
            { header: 'Nama Karyawan', key: 'name', width: 30 },
            { header: 'Total Tugas', key: 'total', width: 15 },
            { header: 'Selesai', key: 'selesai', width: 15 },
            { header: 'Aktif', key: 'active', width: 15 },
            { header: 'Persentase (%)', key: 'percent', width: 15 },
        ];

        data.forEach(r => { sheet.addRow(r); });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Tugas.xlsx');
        await workbook.xlsx.write(res);
        return res.end();
    }

    res.status(400).json({ message: 'Format tidak didukung' });

  } catch (err) {
    console.error("Export Task Error:", err);
    next(err);
  }
};

// =======================================
// MANAJEMEN USER
// =======================================
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;
    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { position: { contains: q } },
        { role: { name: { contains: q } } }
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

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, position, alamat, statusKepegawaian } = req.body;
    const hashed = await bcrypt.hash(password || 'password', 10);
    const roleName = role || 'TENAGA';

    let roleRecord = await prisma.role.findUnique({ where: { name: roleName } });
    if (!roleRecord) {
      roleRecord = await prisma.role.create({ data: { name: roleName } });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        phone: phone || null,
        position: position || null,
        alamat: alamat || null,
        statusKepegawaian: statusKepegawaian || null, 
        roleId: roleRecord.id
      }
    });

    logActivity(req.user?.userId, 'USER_CREATE', { targetUserId: user.id }).catch(() => {});
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, password, role, phone, position, statusKepegawaian } = req.body;
    const data = {};

    if (name) data.name = name;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 10);
    if (phone !== undefined) data.phone = phone;
    if (position !== undefined) data.position = position;
    if (statusKepegawaian !== undefined) data.statusKepegawaian = statusKepegawaian;

    if (role) {
      let roleRecord = await prisma.role.findUnique({ where: { name: role } });
      if (!roleRecord) {
        roleRecord = await prisma.role.create({ data: { name: role } });
      }
      data.roleId = roleRecord.id;
    }

    const updated = await prisma.user.update({ where: { id }, data });
    logActivity(req.user?.userId, 'USER_UPDATE', { targetUserId: updated.id }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.user.delete({ where: { id } });
    logActivity(req.user?.userId, 'USER_DELETE', { targetUserId: id }).catch(() => {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// =======================================
// MANAJEMEN TUGAS
// =======================================
const listTasks = async (req, res, next) => {
  try {
    const { status, assigneeId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = parseInt(assigneeId);

    const tasks = await prisma.task.findMany({
      where,
      include: { 
        assignee: true, 
        createdBy: true,
        comments: { include: { author: true }, orderBy: { createdAt: 'desc' } } 
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const updated = await prisma.task.update({ where: { id }, data: { status } });
    logActivity(req.user?.userId, 'TASK_UPDATE_STATUS', { taskId: updated.id, status }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const getTaskStats = async (req, res, next) => {
  try {
    const now = new Date();
    const pending = await prisma.task.count({ where: { status: 'PENDING' } });
    const progress = await prisma.task.count({ where: { status: 'DALAM_PROGERSS' } });
    const done = await prisma.task.count({ where: { status: 'SELESAI' } });
    const late = await prisma.task.count({ where: { status: { not: 'SELESAI' }, dueDate: { lt: now } } });

    res.json({ pending, progress, done, late });
  } catch (err) {
    next(err);
  }
};

// =======================================
// LAIN-LAIN
// =======================================
const listActivity = async (req, res, next) => {
  try {
    const { userId, from, to } = req.query;
    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
};

const getLaporanRekap = async (req, res, next) => {
  try {
    const now = new Date();
    const startMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const users = await prisma.user.findMany({
      where: { role: { name: { not: 'ADMIN' } } },
      select: { id: true, name: true }
    });

    const totalUsers = users.length;
    const totalDaysInMonth = endMonth.getDate();
    const expectedAttendance = totalUsers * totalDaysInMonth; 

    const totalAttendanceThisMonth = await prisma.attendance.count({
      where: { date: { gte: startMonth, lte: endMonth } }
    });

    const approvedCutiList = await prisma.cuti.findMany({
        where: {
            status: 'DISETUJUI',
            AND: [ { tanggalMulai: { lte: endMonth } }, { tanggalSelesai: { gte: startMonth } } ]
        }
    });

    let totalHariCuti = 0;
    approvedCutiList.forEach(c => {
        let start = c.tanggalMulai < startMonth ? startMonth : c.tanggalMulai;
        let end = c.tanggalSelesai > endMonth ? endMonth : c.tanggalSelesai;
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        end = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1; 
        totalHariCuti += diffDays;
    });

    let totalAbsen = expectedAttendance - totalAttendanceThisMonth - totalHariCuti;
    if (totalAbsen < 0) totalAbsen = 0; 

    const denominator = expectedAttendance > 0 ? expectedAttendance : 1;
    const rataRataHadir = Math.round((totalAttendanceThisMonth / denominator) * 100);
    const persenCuti = Math.round((totalHariCuti / denominator) * 100);
    const persenAbsen = Math.round((totalAbsen / denominator) * 100);

    const attendanceRecords = await prisma.attendance.findMany({
      where: { date: { gte: startMonth, lte: endMonth } },
      select: { checkIn: true }
    });

    let tepatWaktu = 0;
    let terlambat = 0;
    attendanceRecords.forEach(r => {
      const d = new Date(r.checkIn);
      if (d.getHours() < 8 || (d.getHours() === 8 && d.getMinutes() <= 30)) {
        tepatWaktu++;
      } else {
        terlambat++;
      }
    });
    const persenTepatWaktu = Math.round((tepatWaktu / denominator) * 100);
    const persenTerlambat = Math.round((terlambat / denominator) * 100);

    const rekapAbsensi = [];
    for (const user of users) {
      const userAttendance = await prisma.attendance.findMany({
        where: { userId: user.id, date: { gte: startMonth, lte: endMonth } },
        select: { checkIn: true }
      });
      const hadir = userAttendance.length;

      let terlambatUser = 0;
      userAttendance.forEach(r => {
        const d = new Date(r.checkIn);
        if (d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 30)) terlambatUser++;
      });

      const userCutiList = await prisma.cuti.findMany({
        where: {
          userId: user.id,
          status: 'DISETUJUI',
          AND: [ { tanggalMulai: { lte: endMonth } }, { tanggalSelesai: { gte: startMonth } } ]
        }
      });

      let cutiHariUser = 0;
      userCutiList.forEach(c => {
        let start = c.tanggalMulai < startMonth ? startMonth : c.tanggalMulai;
        let end = c.tanggalSelesai > endMonth ? endMonth : c.tanggalSelesai;
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        end = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        cutiHariUser += (Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1);
      });

      let absenUser = totalDaysInMonth - hadir - cutiHariUser;
      if (absenUser < 0) absenUser = 0;

      rekapAbsensi.push({
        karyawan: user.name,
        hadir,
        terlambat: terlambatUser,
        absen: absenUser, 
        cuti: cutiHariUser
      });
    }

    const rekapTugas = [];
    for (const user of users) {
      const totalTugas = await prisma.task.count({ where: { assigneeId: user.id } });
      const tugasSelesai = await prisma.task.count({ where: { assigneeId: user.id, status: 'SELESAI' } });
      const tugasAktif = totalTugas - tugasSelesai;
      const persenSelesai = totalTugas > 0 ? Math.round((tugasSelesai / totalTugas) * 100) : 0;
      rekapTugas.push({ karyawan: user.name, selesaiPersen: persenSelesai, tugasAktif });
    }

    res.json({
      analisisProduktivitas: { rataRataHadir },
      statistikDetail: {
        kehadiranTepatWaktu: persenTepatWaktu,
        terlambat: persenTerlambat,
        absen: persenAbsen,
        cuti: persenCuti
      },
      rekapAbsensi,
      rekapPenyelesaianTugas: rekapTugas
    });
  } catch (err) {
    next(err);
  }
};

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
  exportAttendance,
  exportTaskCompletion, // <-- WAJIB ADA
  getTaskStats,
  getLaporanRekap
};