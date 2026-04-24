/*
  Warnings:

  - You are about to drop the column `accountCategory` on the `bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `includeInCalculations` on the `bank_accounts` table. All the data in the column will be lost.
  - You are about to drop the column `budgetPeriodId` on the `budget_item` table. All the data in the column will be lost.
  - You are about to drop the column `TransferPairId` on the `transaction` table. All the data in the column will be lost.
  - You are about to drop the column `isSavingsContribution` on the `transaction` table. All the data in the column will be lost.
  - You are about to drop the column `mechantName` on the `transaction` table. All the data in the column will be lost.
  - You are about to drop the column `monthlySavingsGoal` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `safeToSpendPeriod` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the `budget_period` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dueDate` to the `budget_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `budget_item` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "budget_item" DROP CONSTRAINT "budget_item_budgetPeriodId_fkey";

-- DropForeignKey
ALTER TABLE "budget_period" DROP CONSTRAINT "budget_period_userId_fkey";

-- AlterTable
ALTER TABLE "bank_accounts" DROP COLUMN "accountCategory",
DROP COLUMN "includeInCalculations",
ADD COLUMN     "isSavingsAccount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "budget_item" DROP COLUMN "budgetPeriodId",
ADD COLUMN     "amountSaved" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMonthlySavingGoal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReccuring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transaction" DROP COLUMN "TransferPairId",
DROP COLUMN "isSavingsContribution",
DROP COLUMN "mechantName",
ADD COLUMN     "merchantName" TEXT;

-- AlterTable
ALTER TABLE "user_settings" DROP COLUMN "monthlySavingsGoal",
DROP COLUMN "safeToSpendPeriod",
ADD COLUMN     "desiredMinimumMonthlySpend" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "budget_period";

-- CreateTable
CREATE TABLE "budget_month" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalIncome" DECIMAL(65,30) NOT NULL,
    "totalSpent" DECIMAL(65,30) NOT NULL,
    "totalSaved" DECIMAL(65,30) NOT NULL,
    "safeToSpendSnapshot" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_month_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "budget_month" ADD CONSTRAINT "budget_month_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
