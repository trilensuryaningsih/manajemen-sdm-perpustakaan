const prisma = require('../prismaClient');

// Ambil Pengaturan
const getSettings = async (req, res, next) => {
  try {
    // Kita cari setting dengan key 'ATTENDANCE_CONFIG'
    let setting = await prisma.systemSetting.findUnique({
      where: { key: 'ATTENDANCE_CONFIG' }
    });

    // Default value jika belum ada di database
    if (!setting) {
      setting = {
        value: {
          startHour: 8,
          startMinute: 0,
          tolerance: 15
        }
      };
    }

    res.json(setting.value);
  } catch (err) {
    next(err);
  }
};

// Simpan Pengaturan
const updateSettings = async (req, res, next) => {
  try {
    const { startHour, startMinute, tolerance } = req.body;

    // Upsert: Update jika ada, Create jika belum ada
    const setting = await prisma.systemSetting.upsert({
      where: { key: 'ATTENDANCE_CONFIG' },
      update: {
        value: { startHour: parseInt(startHour), startMinute: parseInt(startMinute), tolerance: parseInt(tolerance) }
      },
      create: {
        key: 'ATTENDANCE_CONFIG',
        value: { startHour: parseInt(startHour), startMinute: parseInt(startMinute), tolerance: parseInt(tolerance) }
      }
    });

    res.json({ message: "Pengaturan berhasil disimpan", data: setting.value });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSettings, updateSettings };

