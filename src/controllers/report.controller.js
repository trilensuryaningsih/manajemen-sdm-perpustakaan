const prisma = require('../prismaClient');
const { logActivity } = require('../services/activity.service');
const path = require('path');

const createReport = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // UBAH DARI 'content' MENJADI 'note' SESUAI SCHEMA PRISMA
    const { date, note } = req.body; 
    
    const d = date ? new Date(date) : new Date();
    
    // Simpan ke kolom 'note'
    const report = await prisma.dailyReport.create({ 
        data: { 
            userId, 
            date: d, 
            note: note || '' 
        } 
    });

    // Handle uploaded files from multer (req.files)
    if (req.files && req.files.length) {
      for (const f of req.files) {
        const fileUrl = `/uploads/${f.filename}`; 
        await prisma.attachment.create({ 
            data: { 
                filename: f.originalname, 
                url: fileUrl, 
                reportId: report.id 
            } 
        });
      }
    }

    logActivity(userId, 'REPORT_CREATE', { reportId: report.id }).catch(() => {});
    
    const created = await prisma.dailyReport.findUnique({ 
        where: { id: report.id }, 
        include: { attachments: true } 
    });
    
    res.status(201).json(created);
  } catch (err) { next(err); }
};

const listReports = async (req, res, next) => {
  try {
    const { userId, from, to } = req.query;
    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (from || to) where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
    const rows = await prisma.dailyReport.findMany({ where, include: { user: true, attachments: true }, orderBy: { date: 'desc' } });
    res.json(rows);
  } catch (err) { next(err); }
};

module.exports = { createReport, listReports };
