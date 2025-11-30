const express = require('express');
const router = express.Router();
const { auth, permit } = require('../middlewares/auth.middleware');
const taskCtrl = require('../controllers/task.controller');

// list tasks (for authenticated user)
router.get('/', auth, taskCtrl.listForUser);

// create task (permit TENAGA or ADMIN)
router.post('/', auth, permit('ADMIN', 'TENAGA'), taskCtrl.createTask);

// update task status (user or admin)
router.patch('/:id/status', auth, taskCtrl.updateStatus);

module.exports = router;
