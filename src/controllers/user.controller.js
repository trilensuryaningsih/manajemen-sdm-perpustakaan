const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

// Helper: start of day
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Helper: start of month
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

// =======================================
// 1. DASHBOARD USER (TENDIK)
// =======================================
const getDashboard = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const now = new Date();
        const today = startOfDay(now);
        const endOfToday = new Date(today);
        endOfToday.setDate(endOfToday.getDate() + 1);
        
        const startMonth = startOfMonth(now);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // 1. Hari Kehadiran Bulan Ini
        const hariKehadiranBulanIni = await prisma.attendance.count({
            where: {
                userId,
                date: {
                    gte: startMonth,
                    lte: endMonth
                }
            }
        });

        // 2. Laporan Dikirim (bulan ini)
        const laporanDikirim = await prisma.dailyReport.count({
            where: {
                userId,
                date: {
                    gte: startMonth,
                    lte: endMonth
                }
            }
        });

        // 3. Tingkat Penyelesaian (persentase penyelesaian tugas oleh user di bulan ini)
		// Dihitung sebagai: completed tasks this month / total tasks assigned this month
		const tasksAssignedThisMonth = await prisma.task.count({
			where: {
				assigneeId: userId,
				createdAt: {
					gte: startMonth,
					lte: endMonth
				}
			}
		});
		const tasksCompletedThisMonth = await prisma.task.count({
			where: {
				assigneeId: userId,
				status: 'SELESAI',
				updatedAt: {
					gte: startMonth,
					lte: endMonth
				}
			}
		});
		const tingkatPenyelesaian = tasksAssignedThisMonth > 0
			? Math.round((tasksCompletedThisMonth / tasksAssignedThisMonth) * 100)
			: 0;


        // 4. Absensi Hari Ini (check-in & check-out)
        const absensiHariIni = await prisma.attendance.findFirst({
            where: {
                userId,
                date: {
                    gte: today,
                    lt: endOfToday
                }
            }
        });

        // 5. Tugas Saya
        const tugasSaya = await prisma.task.findMany({
            where: {
                assigneeId: userId
            },
            include: {
                createdBy: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        // 6. Aktivitas Hari Ini
        const aktivitasHariIni = await prisma.activityLog.findMany({
            where: {
                userId,
                createdAt: {
                    gte: today,
                    lt: endOfToday
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        res.json({
            hariKehadiranBulanIni,
            laporanDikirim,
            tingkatPenyelesaian,
            absensiHariIni,
            tugasSaya,
            aktivitasHariIni
        });
    } catch (err) {
        next(err);
    }
};

// =======================================
// 2. GET PROFILE (LENGKAP: Dengan Alamat & Telepon)
// =======================================
const getProfile = async (req, res, next) => {
    try {
        const id = req.user?.userId;
        
        const user = await prisma.user.findUnique({ 
            where: { id }, 
            include: { role: true } 
        });
        
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        // Return data lengkap
        res.json({ 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role.name, 
            position: user.position, 
            phone: user.phone, 
            alamat: user.alamat, 
            createdAt: user.createdAt 
        });
    } catch (err) { next(err); }
};

// =======================================
// 3. CHANGE PASSWORD
// =======================================
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Password lama dan baru wajib diisi' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        const ok = await bcrypt.compare(oldPassword, user.password);
        if (!ok) return res.status(400).json({ message: 'Password lama salah' });
        
        const hashed = await bcrypt.hash(newPassword, 10);
        
        await prisma.user.update({ 
            where: { id: userId }, 
            data: { password: hashed } 
        });
        
        res.json({ message: 'Password berhasil diubah' });
    } catch (err) { next(err); }
};

// =======================================
// 4. UPDATE PROFILE (NAMA & TELEPON SAJA)
// =======================================
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { name, phone } = req.body; 
        
        const data = {};
        if (name) data.name = name;
        // Kita gunakan logika yang sudah direvisi sebelumnya (hanya telepon, alamat diabaikan)
        if (phone !== undefined) data.phone = phone;
        
        const updated = await prisma.user.update({ 
            where: { id: userId }, 
            data 
        });
        
        res.json({ 
            id: updated.id, 
            name: updated.name, 
            email: updated.email,
            phone: updated.phone,
            alamat: updated.alamat
        });
    } catch (err) { next(err); }
};

module.exports = { getDashboard, getProfile, changePassword, updateProfile };