const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/users.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const taskRoutes = require('./routes/tasks.routes');
const reportRoutes = require('./routes/reports.routes');
const adminRoutes = require('./routes/admin');
const cutiRoutes = require('./routes/cuti.routes');
const errorHandler = require('./middlewares/error.middleware');


const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
const path = require('path');
// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cuti', cutiRoutes);





app.use(errorHandler);

module.exports = app;
