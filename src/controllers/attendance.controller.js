const prisma = require('../prismaClient');
const { logActivity } = require('../services/activity.service');

// ==========================================
// 1. CHECK IN (DENGAN LOGIKA WAKTU & TOLERANSI)
// ==========================================
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    // Normalisasi tanggal (hanya tahun-bulan-hari) untuk cek duplikat harian
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // A. CEK DUPLIKAT (Mencegah absen 2x sehari)
    const existing = await prisma.attendance.findFirst({
      where: { userId, date: dateOnly }
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Anda sudah melakukan check-in hari ini.' });
    }

    // ============================================================
    // B. AMBIL PENGATURAN JAM DARI DATABASE
    // ============================================================
    const settingRecord = await prisma.systemSetting.findUnique({
      where: { key: 'ATTENDANCE_CONFIG' }
    });
    
    // Default value jika belum ada pengaturan di database:
    // Jam Masuk: 08:00, Toleransi: 15 menit
    const config = settingRecord?.value || { startHour: 8, startMinute: 0, tolerance: 15 };

    // Set Waktu Mulai Kerja Hari Ini berdasarkan konfigurasi
    const workStartTime = new Date(now);
    workStartTime.setHours(config.startHour, config.startMinute, 0, 0);

    // ============================================================
    // C. VALIDASI: "ABSEN BELUM DIBUKA"
    // ============================================================
    // Jika waktu sekarang (now) KURANG DARI jam masuk kerja
    if (now < workStartTime) {
       const jamMasukStr = `${config.startHour.toString().padStart(2, '0')}:${config.startMinute.toString().padStart(2, '0')}`;
       return res.status(400).json({ 
         message: `Absen belum dibuka. Jam masuk dimulai pukul ${jamMasukStr}.` 
       });
    }

    // ============================================================
    // D. HITUNG STATUS (TERLAMBAT / TEPAT WAKTU)
    // ============================================================
    // Hitung batas waktu toleransi (Jam Masuk + Menit Toleransi)
    const lateLimitTime = new Date(workStartTime.getTime() + (config.tolerance * 60000));

    let statusAbsen = 'HADIR_TEPAT_WAKTU';
    
    // Jika waktu sekarang MELEBIHI batas toleransi, maka TERLAMBAT
    if (now > lateLimitTime) {
        statusAbsen = 'TERLAMBAT';
    }

    // ============================================================
    // E. SIMPAN KE DATABASE
    // ============================================================
    const att = await prisma.attendance.create({ 
      data: { 
        userId, 
        date: dateOnly, 
        checkIn: now,
        statusAbsen: statusAbsen // Simpan status otomatis
      } 
    });

    // Catat aktivitas ke log
    logActivity(userId, 'ATTENDANCE_CHECKIN', { attendanceId: att.id }).catch(() => {});
    
    // Format pesan respon agar user tahu statusnya
    const jamBatasStr = `${lateLimitTime.getHours().toString().padStart(2, '0')}:${lateLimitTime.getMinutes().toString().padStart(2, '0')}`;
    
    res.status(201).json({
        ...att,
        message: statusAbsen === 'TERLAMBAT' 
            ? `Absen berhasil, namun Anda Terlambat (Batas toleransi: ${jamBatasStr}).` 
            : "Absen berhasil, Terima kasih telah hadir tepat waktu."
    });

  } catch (err) { 
    next(err); 
  }
};

// ==========================================
// 2. CHECK OUT
// ==========================================
const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findFirst({ 
        where: { userId, date: dateOnly }
    });

    if (!existing) {
        return res.status(400).json({ message: 'Anda belum melakukan check-in hari ini.' });
    }

    // Update data checkout
    const updated = await prisma.attendance.update({ 
        where: { id: existing.id }, 
        data: { 
            checkOut: now, 
            note: req.body.note || null 
        } 
    });

    logActivity(userId, 'ATTENDANCE_CHECKOUT', { attendanceId: updated.id }).catch(() => {});
    
    res.json({
        ...updated,
        message: "Check-out berhasil. Hati-hati di jalan!"
    });

  } catch (err) { 
    next(err); 
  }
};

// ==========================================
// 3. RIWAYAT ABSENSI
// ==========================================
const getHistory = async (req, res, next) => {
  try {
    const { userId, from, to } = req.query;
    const where = {};

    // Filter by User ID
    if (userId) where.userId = parseInt(userId);

    // Filter by Date Range
    if (from || to) {
        where.date = {};
        if (from) where.date.gte = new Date(from);
        if (to) where.date.lte = new Date(to);
    }

    const data = await prisma.attendance.findMany({ 
        where, 
        include: { user: true }, 
        orderBy: { date: 'desc' }
    });

    res.json(data);
  } catch (err) { 
    next(err); 
  }
};

module.exports = { checkIn, checkOut, getHistory };