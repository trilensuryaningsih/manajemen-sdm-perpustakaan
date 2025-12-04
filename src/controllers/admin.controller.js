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
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // 1. Total Karyawan (tidak termasuk admin)
    const totalKaryawan = await prisma.user.count({
      where: {
        role: {
          name: { not: 'ADMIN' }
        }
      }
    });

    // 2. Karyawan yang Hadir Hari Ini (sudah check-in)
    const karyawanAktifHariIni = await prisma.attendance.count({
      where: {
        date: {
          gte: today,
          lt: endOfToday
        }
      }
    });

    // 3. Total Laporan Harian Hari Ini
    const laporanHarian = await prisma.dailyReport.count({
      where: {
        date: {
          gte: today,
          lt: endOfToday
        }
      }
    });

    // 4. Tingkat Kehadiran (persentase)
    const tingkatKehadiran = totalKaryawan > 0 
      ? Math.round((karyawanAktifHariIni / totalKaryawan) * 100) 
      : 0;

    // 5. Absensi Hari Ini (detail dengan info user)
    const absensiHariIni = await prisma.attendance.findMany({
      where: {
        date: {
          gte: today,
          lt: endOfToday
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            position: true,
            email: true
          }
        }
      },
      orderBy: {
        checkIn: 'asc'
      }
    });

    // 6. Tugas Terbaru (10 tugas terakhir)
    const tugasTerbaru = await prisma.task.findMany({
      take: 10,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
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
// CREATE USER
// =======================================
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, position, alamat, statusKepegawaian } = req.body;

    // hash password
    const hashed = await bcrypt.hash(password || 'password', 10);

    const roleName = role || 'TENAGA';

    let roleRecord = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!roleRecord) {
      roleRecord = await prisma.role.create({
        data: { name: roleName }
      });
    }

    // buat user dengan statusKepegawaian
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

    logActivity(req.user?.userId, 'USER_CREATE', {
      targetUserId: user.id
    }).catch(() => {});

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      position: user.position,
      alamat: user.alamat,
      statusKepegawaian: user.statusKepegawaian
    });
  } catch (err) {
    next(err);
  }
};

// =======================================
// UPDATE USER
// =======================================
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
      position: updated.position,
      statusKepegawaian: updated.statusKepegawaian
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
      include: { 
        assignee: true, 
        createdBy: true,
        comments: {
            include: { author: true },
            orderBy: { createdAt: 'desc' } 
        } 
      },
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
// GET TASK STATISTICS
// =======================================
const getTaskStats = async (req, res, next) => {
  try {
    const now = new Date();

    const pending = await prisma.task.count({
      where: { status: 'PENDING' }
    });

    const progress = await prisma.task.count({
      where: { status: 'DALAM_PROGERSS' }
    });

    const done = await prisma.task.count({
      where: { status: 'SELESAI' }
    });

    const late = await prisma.task.count({
      where: {
        status: { not: 'SELESAI' },
        dueDate: { lt: now } 
      }
    });

    res.json({
      pending,
      progress,
      done,
      late
    });
  } catch (err) {
    next(err);
  }
};

// =======================================
// LAPORAN & REKAP (ADMIN) - FIXED LOGIC
// =======================================
const getLaporanRekap = async (req, res, next) => {
  try {
    const now = new Date();
    const startMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all non-admin users
    const users = await prisma.user.findMany({
      where: {
        role: {
          name: { not: 'ADMIN' }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    const totalUsers = users.length;
    const totalDaysInMonth = endMonth.getDate();
    const expectedAttendance = totalUsers * totalDaysInMonth; // Total hari potensial untuk semua karyawan

    // 1. DATA HADIR (GLOBAL)
    const totalAttendanceThisMonth = await prisma.attendance.count({
      where: {
        date: {
          gte: startMonth,
          lte: endMonth
        }
      }
    });

    // 2. DATA CUTI (GLOBAL - HITUNG HARI)
    // Ambil semua cuti yang disetujui bulan ini
    const approvedCutiList = await prisma.cuti.findMany({
        where: {
            status: 'DISETUJUI',
            AND: [
                { tanggalMulai: { lte: endMonth } },
                { tanggalSelesai: { gte: startMonth } }
            ]
        }
    });

    let totalHariCuti = 0;
    approvedCutiList.forEach(c => {
        // Clamp tanggal agar tidak keluar dari bulan ini
        let start = c.tanggalMulai < startMonth ? startMonth : c.tanggalMulai;
        let end = c.tanggalSelesai > endMonth ? endMonth : c.tanggalSelesai;
        
        // Normalisasi jam ke 00:00 untuk hitung selisih hari
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        end = new Date(end.getFullYear(), end.getMonth(), end.getDate());

        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 karena inklusif
        totalHariCuti += diffDays;
    });

    // 3. DATA ABSEN (GLOBAL)
    // Rumus: Total Potensial - Hadir - Total Hari Cuti
    let totalAbsen = expectedAttendance - totalAttendanceThisMonth - totalHariCuti;
    if (totalAbsen < 0) totalAbsen = 0; // Safety check

    // --- Hitung Persentase ---
    const denominator = expectedAttendance > 0 ? expectedAttendance : 1;
    
    const rataRataHadir = Math.round((totalAttendanceThisMonth / denominator) * 100);
    const persenCuti = Math.round((totalHariCuti / denominator) * 100);
    const persenAbsen = Math.round((totalAbsen / denominator) * 100);

    // Detail Tepat Waktu vs Terlambat (untuk legend)
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


    // 4. REKAP ABSENSI PER KARYAWAN (DETAIL)
    const rekapAbsensi = [];
    for (const user of users) {
      // Hadir
      const userAttendance = await prisma.attendance.findMany({
        where: {
          userId: user.id,
          date: { gte: startMonth, lte: endMonth }
        },
        select: { checkIn: true }
      });
      const hadir = userAttendance.length;

      // Terlambat
      let terlambatUser = 0;
      userAttendance.forEach(r => {
        const d = new Date(r.checkIn);
        if (d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 30)) {
          terlambatUser++;
        }
      });

      // Cuti (Hitung Hari per User)
      const userCutiList = await prisma.cuti.findMany({
        where: {
          userId: user.id,
          status: 'DISETUJUI',
          AND: [
            { tanggalMulai: { lte: endMonth } },
            { tanggalSelesai: { gte: startMonth } }
          ]
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

      // Absen User
      // Rumus: Total Hari Bulan Ini - Hadir - Hari Cuti
      let absenUser = totalDaysInMonth - hadir - cutiHariUser;
      if (absenUser < 0) absenUser = 0;

      rekapAbsensi.push({
        karyawan: user.name,
        hadir,
        terlambat: terlambatUser,
        absen: absenUser,    // Sekarang sudah dikurangi cuti
        cuti: cutiHariUser   // Menampilkan jumlah hari cuti
      });
    }

    // 5. REKAP TUGAS
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
        absen: persenAbsen, // Sekarang persen ini sudah bersih dari cuti
        cuti: persenCuti
      },
      rekapAbsensi,
      rekapPenyelesaianTugas: rekapTugas
    });
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
  exportAttendance,
  getTaskStats,
  getLaporanRekap
};