const express = require('express');
const router = express.Router();
const { auth, permit } = require('../middlewares/auth.middleware');
const taskCtrl = require('../controllers/task.controller');

// list tasks (for authenticated user)
router.get('/', auth, taskCtrl.listForUser);

// create task (permit TENAGA or ADMIN)
router.post('/', auth, permit('ADMIN', 'TENAGA'), taskCtrl.createTask);

// update full task details (Edit) - FITUR BARU
router.put('/:id', auth, permit('ADMIN', 'TENAGA'), taskCtrl.updateTask);

// delete task (Hapus) - FITUR BARU
router.delete('/:id', auth, permit('ADMIN', 'TENAGA'), taskCtrl.deleteTask);

// update task status (user or admin)
router.patch('/:id/status', auth, taskCtrl.updateStatus);

// --- ROUTE BARU: TAMBAH KOMENTAR ---
router.post('/:id/note', auth, taskCtrl.saveTaskNote);

module.exports = router;
