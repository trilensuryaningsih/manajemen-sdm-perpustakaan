/*
  Warnings:

  - You are about to alter the column `status` on the `cuti` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(2))`.
  - You are about to alter the column `status` on the `task` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `Enum(EnumId(0))`.
  - Made the column `prioritas` on table `task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `cuti` MODIFY `status` ENUM('MENUNGGU_KONFIRMASI', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU_KONFIRMASI';

-- AlterTable
ALTER TABLE `task` MODIFY `status` ENUM('BARU', 'SEDANG_DIKERJAKAN', 'SELESAI') NOT NULL DEFAULT 'BARU',
    MODIFY `prioritas` ENUM('TINGGI', 'NORMAL') NOT NULL DEFAULT 'NORMAL';
