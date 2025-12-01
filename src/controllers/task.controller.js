const prisma = require('../prismaClient');
const { logActivity } = require('../services/activity.service');

const listForUser = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tasks = await prisma.task.findMany({ where: { OR: [{ assigneeId: userId }, { createdById: userId }] }, include: { assignee: true, createdBy: true }, orderBy: { updatedAt: 'desc' } });
    res.json(tasks);
  } catch (err) { next(err); }
};

const createTask = async (req, res, next) => {
  try {
    const { title, description, assigneeId, dueDate, prioritas } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        assigneeId: assigneeId || null,
        createdById: req.user.userId,
        dueDate: dueDate ? new Date(dueDate) : null,
        prioritas: prioritas || "NORMAL"   // ⭐ PRIORITAS DITAMBAHKAN
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
    // allow if admin or assignee or creator
    const acting = req.user;
    if (acting.role !== 'ADMIN' && acting.userId !== task.assigneeId && acting.userId !== task.createdById) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const updated = await prisma.task.update({ where: { id }, data: { status } });
    logActivity(req.user?.userId, 'TASK_UPDATE_STATUS', { taskId: id, status }).catch?.(() => {});
    res.json(updated);
  } catch (err) { next(err); }
};

module.exports = { listForUser, createTask, updateStatus };
