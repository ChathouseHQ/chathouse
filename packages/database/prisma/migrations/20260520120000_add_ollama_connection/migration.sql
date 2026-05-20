ALTER TABLE `api_keys` ADD COLUMN `baseUrl` VARCHAR(512) NULL;

ALTER TABLE `api_keys` MODIFY `encryptedKey` TEXT NULL;
