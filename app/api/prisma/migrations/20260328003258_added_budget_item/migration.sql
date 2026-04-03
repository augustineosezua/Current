-- CreateTable
CREATE TABLE "budget_item" (
    "id" TEXT NOT NULL,
    "budgetPeriodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_item_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_budgetPeriodId_fkey" FOREIGN KEY ("budgetPeriodId") REFERENCES "budget_period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
