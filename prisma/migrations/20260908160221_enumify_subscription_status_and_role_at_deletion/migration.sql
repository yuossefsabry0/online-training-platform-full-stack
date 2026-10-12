-- AlterTable
ALTER TABLE `subscriptions` MODIFY `status` ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `deleted_accounts` MODIFY `roleAtDeletion` ENUM('BASIC', 'MEMBER', 'ADMIN', 'SUPER_ADMIN') NOT NULL;
