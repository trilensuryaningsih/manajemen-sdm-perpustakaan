const prisma = require('../prismaClient');

const logActivity = async (userId, action, metadata = {}) => {
  try {
    if (!userId) return;
    await prisma.activityLog.create({ data: { userId, action, metadata } });
  } catch (err) {
    console.error('logActivity error:', err);
  }
};

module.exports = { logActivity };
