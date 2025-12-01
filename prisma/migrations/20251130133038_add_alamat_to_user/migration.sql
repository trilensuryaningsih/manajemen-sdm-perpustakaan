/*
  Warnings:

  - You are about to drop the column `content` on the `dailyreport` table. All the data in the column will be lost.
  - Added the required column `note` to the `DailyReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `dailyreport` DROP COLUMN `content`,
    ADD COLUMN `note` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `task` ADD COLUMN `prioritas` ENUM('TINGGI', 'SEDANG', 'RENDAH') NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `alamat` VARCHAR(191) NULL;
