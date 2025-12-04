const prisma = require('../prismaClient');
const { logActivity } = require('../services/activity.service');

// ... (Kode listForUser yang lama diubah sedikit untuk include comments)
const listForUser = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tasks = await prisma.task.findMany({ 
      where: { 
        OR: [{ assigneeId: userId }, { createdById: userId }] 
      }, 
      include: { 
        assignee: true, 
        createdBy: true,
        comments: { include: { author: true } } // Include comments untuk dicek di FE
      }, 
      orderBy: { updatedAt: 'desc' } 
    });
    res.json(tasks);
  } catch (err) { next(err); }
};


// --- FUNGSI BARU: TAMBAH KOMENTAR ---
const saveTaskNote = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id);
    const { text } = req.body; // Isi catatan dikirim sebagai 'text'
    const authorId = req.user.userId;

    if (!text) return res.status(400).json({ message: "Catatan tidak boleh kosong" });

    // 1. Cek apakah user ini sudah punya komentar di tugas ini?
    const existingComment = await prisma.taskComment.findFirst({
        where: {
            taskId: taskId,
            authorId: authorId
        }
    });

    let result;
    if (existingComment) {
        // UPDATE (Jika sudah ada)
        result = await prisma.taskComment.update({
            where: { id: existingComment.id },
            data: { text: text } // Update teksnya
        });
    } else {
        // CREATE (Jika belum ada)
        result = await prisma.taskComment.create({
            data: {
                taskId,
                authorId,
                text
            }
        });
    }

    logActivity(req.user?.userId, 'TASK_NOTE_SAVE', { taskId }).catch(() => {});
    res.json(result);

  } catch (err) { next(err); }
};

const createTask = async (req, res, next) => {
  try {
    const { title, description, assigneeId, dueDate, prioritas } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        assigneeId: assigneeId ? parseInt(assigneeId) : null, // Pastikan integer
        createdById: req.user.userId,
        dueDate: dueDate ? new Date(dueDate) : null,
        prioritas: prioritas || "NORMAL"
      }
    });

    logActivity(req.user?.userId, 'TASK_CREATE', { taskId: task.id }).catch?.(() => {});
    res.status(201).json(task);

  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const task = await prisma.task.findUnique({ where: { id } });
    
    if (!task) return res.status(404).json({ message: 'Task not found' });
    
    // Validasi hak akses: hanya admin, assignee, atau pembuat yang bisa ubah status
    const acting = req.user;
    if (acting.role !== 'ADMIN' && acting.userId !== task.assigneeId && acting.userId !== task.createdById) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updated = await prisma.task.update({ where: { id }, data: { status } });
    logActivity(req.user?.userId, 'TASK_UPDATE_STATUS', { taskId: id, status }).catch?.(() => {});
    res.json(updated);
  } catch (err) { next(err); }
};

// --- FUNGSI BARU UNTUK EDIT TUGAS ---
const updateTask = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, assigneeId, dueDate, prioritas } = req.body;

    // Cek apakah tugas ada
    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) return res.status(404).json({ message: 'Task not found' });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        prioritas
      }
    });

    logActivity(req.user?.userId, 'TASK_UPDATE', { taskId: id }).catch?.(() => {});
    res.json(updated);
  } catch (err) { next(err); }
};

// --- FUNGSI BARU UNTUK HAPUS TUGAS ---
const deleteTask = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    // Cek apakah tugas ada
    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask) return res.status(404).json({ message: 'Task not found' });

    await prisma.task.delete({ where: { id } });
    
    logActivity(req.user?.userId, 'TASK_DELETE', { taskId: id }).catch?.(() => {});
    res.status(204).send();
  } catch (err) { next(err); }
};

// Export semua fungsi
module.exports = { 
  listForUser, 
  createTask, 
  updateStatus, 
  updateTask, // <-- Tambahan
  deleteTask,  // <-- Tambahan
  saveTaskNote
};