// Numbers core computed, turned into labelled lines the model can copy from. The same lines are shown in the UI,
// so any sentence the model writes can be checked against them.
import type { AffordResult, AiFigure, AskAnswer, AskFact, WeeklyRecap } from '@current/core';

import type { BudgetData } from '@/db/sts';
import { t, type MessageKey } from '@/i18n';
import { categoryName } from '@/lib/categories';
import { money, monthDayLabel, shortDate, untilLabel } from '@/lib/format';

// a category id's name as shown in the app
function nameOf(input: Pick<BudgetData, 'categories'>, id: string | null): string {
  const category = id ? input.categories.find((c) => c.id === id) : null;
  return category ? categoryName(category) : t('common.uncategorized');
}

// 2.2: the verdict and what it does to the daily number
export function affordFigures(r: AffordResult): AiFigure[] {
  const figures: AiFigure[] = [
    { label: t('afford.f.price'), value: money(r.amount) },
    { label: t('afford.f.verdict'), value: t(`afford.v.${r.verdict}` as MessageKey) },
    { label: t('afford.f.safeNow'), value: money(r.safeToSpend) },
    { label: t('afford.f.perDayNow'), value: money(r.perDayNow) },
  ];
  if (r.verdict !== 'wait' || r.waitUntil) {
    figures.push({ label: t('afford.f.perDayAfter'), value: money(r.newPerDay) });
    figures.push({ label: t('afford.f.until'), value: untilLabel(r.periodEnd) });
  }
  if (r.waitUntil) {
    figures.push({ label: t('afford.f.fitsOn'), value: untilLabel(r.waitUntil) });
    if (r.reason === 'payday' || r.reason === 'semester-money' || r.reason === 'later') {
      figures.push({ label: t('afford.f.because'), value: t(`afford.r.${r.reason}` as MessageKey) });
    }
  }
  return figures;
}

// 2.10: the week in figures
export function recapFigures(recap: WeeklyRecap, input: Pick<BudgetData, 'categories'>): AiFigure[] {
  const figures: AiFigure[] = [
    { label: t('ask.f.range'), value: t('recap.range', { start: monthDayLabel(recap.start), end: monthDayLabel(recap.end) }) },
    { label: t('recap.spent'), value: money(recap.spent) },
    { label: t('recap.lastWeek'), value: money(recap.lastWeekSpent) },
  ];
  if (recap.topCategories.length > 0) {
    figures.push({
      label: t('recap.top'),
      value: recap.topCategories.map((c) => `${nameOf(input, c.categoryId)} ${money(c.amount)}`).join(', '),
    });
  }
  if (recap.biggestChange) {
    figures.push({
      label: `${t('recap.biggest')}: ${nameOf(input, recap.biggestChange.categoryId)}`,
      value: t('recap.change', { amount: money(recap.biggestChange.amount), previous: money(recap.biggestChange.previous) }),
    });
  }
  figures.push({ label: t('recap.perDay'), value: money(recap.perDay) });
  figures.push({ label: t('recap.until'), value: untilLabel(recap.periodEnd) });
  return figures;
}

// "Groceries and Take-out" for a group with no everyday word
function groupName(parts: readonly { categoryId: string }[], input: Pick<BudgetData, 'categories'>): string {
  return parts.map((p) => nameOf(input, p.categoryId)).join(', ');
}

// 2.13: one tool's facts as labelled figures
function factFigures(fact: AskFact, input: BudgetData): AiFigure[] {
  switch (fact.kind) {
    case 'range':
      return [{ label: t('ask.f.range'), value: t('insights.range', { start: monthDayLabel(fact.range.start), end: monthDayLabel(fact.range.end) }) }];
    case 'spent':
      if (fact.parts) {
        return [
          { label: t('ask.f.spentIn', { category: fact.topic ? t(`ask.topic.${fact.topic}` as MessageKey) : groupName(fact.parts, input) }), value: money(fact.amount) },
          ...fact.parts.map((p) => ({ label: `  ${nameOf(input, p.categoryId)}`, value: money(p.amount) })),
        ];
      }
      return [
        {
          label: fact.categoryId ? t('ask.f.spentIn', { category: nameOf(input, fact.categoryId) }) : t('ask.f.spent'),
          value: money(fact.amount),
        },
      ];
    case 'previousSpent':
      return [{ label: t('ask.f.previous'), value: money(fact.amount) }];
    case 'topCategory':
      return [{ label: t('ask.f.top'), value: `${nameOf(input, fact.categoryId)}, ${money(fact.amount)}` }];
    case 'safeToSpend':
      return [{ label: t('ask.f.safe'), value: money(fact.amount) }];
    case 'perDay':
      return [
        { label: t('ask.f.perDay'), value: money(fact.amount) },
        { label: t('ask.f.until'), value: untilLabel(fact.until) },
        { label: t('ask.f.daysLeft'), value: String(fact.daysLeft) },
      ];
    case 'bill':
      return [
        {
          label: t('ask.f.bill', { name: fact.name }),
          value: t(fact.overdue ? 'ask.f.billOverdue' : 'ask.f.billValue', { amount: money(fact.amount), date: monthDayLabel(fact.dueDate) }),
        },
      ];
    case 'billsTotal':
      return [{ label: t('ask.f.billsTotal', { date: monthDayLabel(fact.through) }), value: money(fact.amount) }];
    case 'goal':
      return [
        {
          label: t('ask.f.goal', { name: fact.name }),
          value: t('ask.f.goalValue', { saved: money(fact.saved), target: money(fact.target), date: monthDayLabel(fact.dueDate) }),
        },
        ...(fact.thisPeriod > 0 ? [{ label: t('ask.f.goalThisPeriod', { name: fact.name }), value: money(fact.thisPeriod) }] : []),
      ];
    case 'termPlan':
      return [
        {
          label: t('ask.f.term', { name: fact.name }),
          value: t('ask.f.termValue', {
            amount: money(fact.amount),
            released: money(fact.released),
            perWeek: money(fact.perWeek),
            date: monthDayLabel(fact.endDate),
          }),
        },
      ];
    case 'afford':
      return affordFigures(fact.result);
    case 'place':
      return [{ label: fact.name, value: t('ask.f.placeValue', { amount: money(fact.amount), count: fact.count }) }];
    case 'transaction':
      return [
        {
          label: `${shortDate(fact.date)} · ${fact.merchant ?? nameOf(input, fact.categoryId)}`,
          value: fact.categoryId ? `${money(fact.amount)} (${nameOf(input, fact.categoryId)})` : money(fact.amount),
        },
      ];
    case 'account':
      return [{ label: t('ask.f.account', { name: fact.name ?? t(`accountType.${fact.type}` as MessageKey) }), value: money(fact.balance) }];
    case 'nothing':
      return [{ label: t('ask.f.nothing'), value: t('ask.f.nothingValue') }];
  }
}

// every figure behind an Ask Current answer
export function askFigures(answer: AskAnswer, input: BudgetData): AiFigure[] {
  return answer.facts.flatMap((f) => factFigures(f, input));
}

// 2.13 without a model: a plain reply written from the same facts, so Ask Current answers on every iPhone
export function askReply(answer: AskAnswer, input: BudgetData): string {
  const facts = answer.facts;
  const find = <K extends AskFact['kind']>(kind: K) => facts.find((f): f is Extract<AskFact, { kind: K }> => f.kind === kind);
  if (find('nothing')) {
    if (answer.tool === 'afford') return t('ask.r.affordHow');
    return t(`ask.r.none.${answer.tool}` as MessageKey);
  }
  switch (answer.tool) {
    case 'spending': {
      const range = find('range')!;
      const spent = find('spent')!;
      const before = find('previousSpent')!;
      const dates = t('insights.range', { start: monthDayLabel(range.range.start), end: monthDayLabel(range.range.end) });
      const what = spent.parts
        ? t('ask.r.spentOnGroup', {
            amount: money(spent.amount),
            category: spent.topic ? t(`ask.topic.${spent.topic}` as MessageKey) : groupName(spent.parts, input),
            list: spent.parts.map((p) => `${nameOf(input, p.categoryId)} ${money(p.amount)}`).join(', '),
          })
        : spent.categoryId
          ? t('ask.r.spentOn', { amount: money(spent.amount), category: nameOf(input, spent.categoryId) })
          : t('ask.r.spent', { amount: money(spent.amount) });
      const compare =
        before.amount === spent.amount
          ? t('ask.r.same')
          : t(spent.amount > before.amount ? 'ask.r.more' : 'ask.r.less', { amount: money(Math.abs(spent.amount - before.amount)), previous: money(before.amount) });
      const tops = facts.filter((f) => f.kind === 'topCategory') as Extract<AskFact, { kind: 'topCategory' }>[];
      const top = tops.length > 0 ? ` ${t('ask.r.top', { list: tops.map((c) => `${nameOf(input, c.categoryId)} (${money(c.amount)})`).join(', ') })}` : '';
      return `${what} (${dates}). ${compare}${top}`;
    }
    case 'safe_to_spend': {
      const safe = find('safeToSpend')!;
      const perDay = find('perDay')!;
      return t('ask.r.safe', { amount: money(safe.amount), perDay: money(perDay.amount), until: untilLabel(perDay.until) });
    }
    case 'upcoming_bills': {
      const bills = facts.filter((f) => f.kind === 'bill') as Extract<AskFact, { kind: 'bill' }>[];
      const total = find('billsTotal')!;
      const next = bills[0]!;
      return `${t(bills.length === 1 ? 'ask.r.billsOne' : 'ask.r.bills', { count: bills.length, total: money(total.amount), date: monthDayLabel(total.through) })} ${t(next.overdue ? 'ask.r.billOverdue' : 'ask.r.billNext', { name: next.name, amount: money(next.amount), date: monthDayLabel(next.dueDate) })}`;
    }
    case 'goal_progress':
      return (facts as Extract<AskFact, { kind: 'goal' }>[])
        .filter((f) => f.kind === 'goal')
        .map((g) => t('ask.r.goal', { name: g.name, saved: money(g.saved), target: money(g.target), date: monthDayLabel(g.dueDate) }))
        .join(' ');
    case 'term_money':
      return (facts as Extract<AskFact, { kind: 'termPlan' }>[])
        .filter((f) => f.kind === 'termPlan')
        .map((p) => t('ask.r.term', { name: p.name, released: money(p.released), amount: money(p.amount), perWeek: money(p.perWeek), date: monthDayLabel(p.endDate) }))
        .join(' ');
    case 'afford': {
      const r = find('afford')!.result;
      const verdict = t(`ask.r.afford.${r.verdict}` as MessageKey, { amount: money(r.amount) });
      if (r.verdict === 'wait') return r.waitUntil ? `${verdict} ${t('ask.r.affordFits', { date: untilLabel(r.waitUntil) })}` : verdict;
      return `${verdict} ${t('ask.r.affordAfter', { before: money(r.perDayNow), after: money(r.newPerDay) })}`;
    }
    case 'top_places':
      return (facts.filter((f) => f.kind === 'place') as Extract<AskFact, { kind: 'place' }>[])
        .map((p) => `${p.name} ${money(p.amount)}`)
        .join(', ');
    case 'recent':
      return (facts.filter((f) => f.kind === 'transaction') as Extract<AskFact, { kind: 'transaction' }>[])
        .map((x) => `${shortDate(x.date)}: ${x.merchant ?? nameOf(input, x.categoryId)} ${money(x.amount)}`)
        .join('. ');
    case 'accounts':
      return (facts.filter((f) => f.kind === 'account') as Extract<AskFact, { kind: 'account' }>[])
        .map((a) => `${a.name ?? t(`accountType.${a.type}` as MessageKey)}: ${money(a.balance)}`)
        .join('. ');
    case 'log_expense':
    case 'decline':
      return t('ask.decline');
  }
}
