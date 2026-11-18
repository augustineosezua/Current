// One-time moments after logging: the Plus trial offer at activation (2.0) and the App Store review prompt (2.7).
// The trial is offered once, after the fifth logged entry or the first semester plan, never at first launch.
// The review prompt comes after the tenth logged entry, never during onboarding and never right after a paywall.
import type { SQLiteDatabase } from 'expo-sqlite';
import * as StoreReview from 'expo-store-review';

import { isCheckInEntry } from '@/db/ledger';
import { saveSetting } from '@/db/plan';
import * as repo from '@/db/repo';

import { isPlusNow, purchasesAvailable } from './plus';

const TRIAL_AFTER_LOGGED = 5;
const REVIEW_AFTER_LOGGED = 10;
// a paywall this recent holds the review prompt back
const PAYWALL_QUIET_MS = 24 * 60 * 60 * 1000;

export type Milestone = 'trial' | 'review' | null;

// entries the user logged themselves: not bill payments, check-ins, goal moves or imports' history
async function countLogged(db: SQLiteDatabase): Promise<number> {
  const all = await repo.transactions.list(db);
  return all.filter((t) => !t.createdFromBill && !t.goalId && !isCheckInEntry(t.merchantName)).length;
}

// whether to offer the free trial now; records that it was offered, so it only ever happens once
async function trialDue(db: SQLiteDatabase, trigger: 'logged' | 'termPlan'): Promise<boolean> {
  if (isPlusNow() || !purchasesAvailable()) return false;
  const settings = await repo.getSettings(db);
  if (settings.trialOfferedAt) return false;
  if (trigger === 'logged' && (await countLogged(db)) < TRIAL_AFTER_LOGGED) return false;
  await saveSetting(db, 'trialOfferedAt', new Date().toISOString());
  return true;
}

// after a new entry is logged: maybe offer the trial, otherwise maybe ask for a review
export async function afterLogged(db: SQLiteDatabase, now = new Date()): Promise<Milestone> {
  if (await trialDue(db, 'logged')) return 'trial';
  const settings = await repo.getSettings(db);
  if (settings.reviewAskedAt) return null;
  if (settings.paywallShownAt && now.getTime() - Date.parse(settings.paywallShownAt) < PAYWALL_QUIET_MS) return null;
  if ((await countLogged(db)) < REVIEW_AFTER_LOGGED) return null;
  if (!(await StoreReview.isAvailableAsync())) return null;
  await saveSetting(db, 'reviewAskedAt', now.toISOString());
  await StoreReview.requestReview();
  return 'review';
}

// after the first semester plan is saved: maybe offer the trial
export async function afterTermPlan(db: SQLiteDatabase): Promise<Milestone> {
  return (await trialDue(db, 'termPlan')) ? 'trial' : null;
}
