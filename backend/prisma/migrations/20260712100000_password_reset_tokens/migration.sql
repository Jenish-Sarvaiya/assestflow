-- Durable password reset tokens. Store only the hash so a database leak cannot be used to reset accounts.
CREATE TABLE `PasswordResetToken` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tokenHash` VARCHAR(191) NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
  INDEX `PasswordResetToken_employeeId_idx`(`employeeId`),
  INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PasswordResetToken_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
