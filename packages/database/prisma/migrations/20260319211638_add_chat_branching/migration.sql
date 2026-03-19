-- AlterTable
ALTER TABLE `chats` ADD COLUMN `branchedFromId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `chats_branchedFromId_idx` ON `chats`(`branchedFromId`);

-- AddForeignKey
ALTER TABLE `chats` ADD CONSTRAINT `chats_branchedFromId_fkey` FOREIGN KEY (`branchedFromId`) REFERENCES `chats`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
