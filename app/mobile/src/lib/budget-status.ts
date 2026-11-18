// 2.3 where each category limit stands this period, and the line its banner or notification shows.
import { getCategoryBudgetStatuses, type CategoryBudgetStatus, type StsResult } from '@current/core';

import type { BudgetData } from '@/db/sts';
import { t } from '@/i18n';

import { categoryName } from './categories';
import { money, periodPhrase, untilLabel } from './format';

// statuses for every limit, as of now
export function budgetStatuses(input: BudgetData, result: StsResult, now = new Date()): CategoryBudgetStatus[] {
  return getCategoryBudgetStatuses(input.categoryBudgets, input.transactions, input.categories, result.period, now, {
    settings: input.settings,
    incomes: input.incomes,
    termPlans: input.termPlans,
  });
}

// "$12 left in Food until Friday, Jan 8" or "$8 over in Food"
export function budgetBannerLine(status: CategoryBudgetStatus, input: BudgetData, result: StsResult): string {
  const category = input.categories.find((c) => c.id === status.categoryId);
  const name = category ? categoryName(category) : t('common.uncategorized');
  if (status.left < 0) return t('alert.over', { amount: money(-status.left), category: name });
  return t('alert.leftUntil', { amount: money(status.left), category: name, date: untilLabel(result.daily.periodEnd) });
}

// title and body for a 90% or 100% notification
export function budgetAlertContent(
  status: CategoryBudgetStatus,
  input: BudgetData,
  result: StsResult,
): { title: string; body: string } {
  const category = input.categories.find((c) => c.id === status.categoryId);
  const name = category ? categoryName(category) : t('common.uncategorized');
  if (status.left < 0) {
    return {
      title: t('alert.title100', { category: name }),
      body: t('alert.body100', { amount: money(-status.left), thisPeriod: periodPhrase(result.period.kind, 'thisLower') }),
    };
  }
  return {
    title: t('alert.title90', { category: name }),
    body: t('alert.body90', { amount: money(status.left), date: untilLabel(result.daily.periodEnd) }),
  };
}
