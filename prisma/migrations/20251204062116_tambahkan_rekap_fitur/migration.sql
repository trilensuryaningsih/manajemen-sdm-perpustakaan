/*
  Warnings:

  - A unique constraint covering the columns `[userId,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `statusAbsen` ENUM('HADIR_TEPAT_WAKTU', 'TERLAMBAT', 'ABSEN') NULL;

-- AlterTable
ALTER TABLE `cuti` ADD COLUMN `approverId` INTEGER NULL;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `completion_percent` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX `Attendance_userId_date_key` ON `Attendance`(`userId`, `date`);
