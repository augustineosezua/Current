/*
  Warnings:

  - You are about to drop the column `institutionName` on the `plaid_user` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `transaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_accountId_fkey";

-- AlterTable
ALTER TABLE "plaid_user" DROP COLUMN "institutionName",
ADD COLUMN     "cursor" TEXT,
ALTER COLUMN "lastSyncedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "accountId";
