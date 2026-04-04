/*
  Warnings:

  - The primary key for the `bank_accounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[id]` on the table `bank_accounts` will be added. If there are existing duplicate values, this will fail.
  - Made the column `id` on table `bank_accounts` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_pkey",
ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_id_key" ON "bank_accounts"("id");
