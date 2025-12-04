const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const { auth, permit } = require('../middlewares/auth.middleware');

// All admin routes require authentication and ADMIN role
router.use(auth, permit('ADMIN'));

router.get('/dashboard', adminCtrl.dashboard);

// Users management
router.get('/users', adminCtrl.listUsers);
router.post('/users', adminCtrl.createUser);
router.get('/users/:id', adminCtrl.getUser);
router.put('/users/:id', adminCtrl.updateUser);
router.delete('/users/:id', adminCtrl.deleteUser);

// Tasks
router.get('/tasks', adminCtrl.listTasks);
router.patch('/tasks/:id/status', adminCtrl.updateTaskStatus);
router.get('/task-stats', adminCtrl.getTaskStats);

// Activity
router.get('/activity', adminCtrl.listActivity);

// Exports
router.get('/export/attendance', adminCtrl.exportAttendance);

// Laporan & Rekap
router.get('/laporan-rekap', adminCtrl.getLaporanRekap);
    
module.exports = router;
