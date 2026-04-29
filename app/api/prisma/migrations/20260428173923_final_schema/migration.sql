/*
  Warnings:

  - The `frequency` column on the `bills` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[plaidItemId]` on the table `plaid_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `transactionStatus` to the `transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transactionTime` to the `transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IncomeFrequency" AS ENUM ('one_time', 'daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'yearly');

-- DropIndex
DROP INDEX "plaid_user_userId_key";

-- AlterTable
ALTER TABLE "bills" DROP COLUMN "frequency",
ADD COLUMN     "frequency" "IncomeFrequency";

-- AlterTable
ALTER TABLE "budget_item" ADD COLUMN     "lastPaymentDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "transactionCategory" TEXT,
ADD COLUMN     "transactionLocation" TEXT,
ADD COLUMN     "transactionStatus" TEXT NOT NULL,
ADD COLUMN     "transactionTime" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "frequency" "IncomeFrequency" NOT NULL DEFAULT 'one_time',
    "nextPaymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plaid_user_plaidItemId_key" ON "plaid_user"("plaidItemId");

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
