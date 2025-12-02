const prisma = require('../prismaClient');
const { logActivity } = require('../services/activity.service');

// =========================
// USER AJUKAN CUTI
// =========================
const createCuti = async (req, res, next) => {
  try {
    const { judul, tanggalMulai, tanggalSelesai, alasan } = req.body;

    const cuti = await prisma.cuti.create({
      data: {
        judul,
        tanggalMulai: new Date(tanggalMulai),
        tanggalSelesai: new Date(tanggalSelesai),
        alasan,
        userId: req.user.userId, 
        status: "MENUNGGU_KONFIRMASI"
      }
    });

    logActivity(req.user?.userId, "CUTI_CREATE", { cutiId: cuti.id }).catch(() => {});
    res.status(201).json(cuti);

  } catch (err) {
    next(err);
  }
};

// =========================
// USER LIHAT CUTI PRIBADI
// =========================
const listMyCuti = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const cuti = await prisma.cuti.findMany({
  where: { userId },
  orderBy: { id: "desc" }
});


    res.json(cuti);
  } catch (err) {
    next(err);
  }
};

// =========================
// ADMIN SETUJUI CUTI
// =========================
const approveCuti = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    const updated = await prisma.cuti.update({
      where: { id },
      data: { status: "DISETUJUI", alasanPenolakan: null }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// =========================
// ADMIN TOLAK CUTI
// =========================
const rejectCuti = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { alasanPenolakan } = req.body;

    const updated = await prisma.cuti.update({
      where: { id },
      data: { 
        status: "DITOLAK",
        alasanPenolakan 
      }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCuti,
  listMyCuti,
  approveCuti,
  rejectCuti
};
