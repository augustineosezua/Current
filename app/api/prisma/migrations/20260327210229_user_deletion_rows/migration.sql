-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'pending_deletion', 'deleted');

-- DropForeignKey
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_accountId_fkey";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_scheduled_for" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_accounts"("plaidAccountId") ON DELETE CASCADE ON UPDATE CASCADE;
