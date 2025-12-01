/*
  Warnings:

  - Added the required column `location` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `location` VARCHAR(191) NOT NULL;
