const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const { auth, permit } = require('../middlewares/auth.middleware');

// Semua route di bawah ini butuh Login & Role ADMIN
router.use(auth, permit('ADMIN'));

router.get('/dashboard', adminCtrl.dashboard);

// Manajemen User
router.get('/users', adminCtrl.listUsers);
router.post('/users', adminCtrl.createUser);
router.get('/users/:id', adminCtrl.getUser);
router.put('/users/:id', adminCtrl.updateUser);
router.delete('/users/:id', adminCtrl.deleteUser);

// Manajemen Tugas
router.get('/tasks', adminCtrl.listTasks);
router.patch('/tasks/:id/status', adminCtrl.updateTaskStatus);
router.get('/task-stats', adminCtrl.getTaskStats);

// Activity Log
router.get('/activity', adminCtrl.listActivity);

// --- EXPORT ROUTES ---
router.get('/export/attendance', adminCtrl.exportAttendance);
router.get('/export/tasks', adminCtrl.exportTaskCompletion); // <-- INI WAJIB ADA

// Laporan Dashboard
router.get('/laporan-rekap', adminCtrl.getLaporanRekap);
    
module.exports = router;