// ROADMAP 2.0: Current Plus through Apple In-App Purchase, managed by RevenueCat. The app only reads whether the
// "plus" entitlement is active; RevenueCat and Apple hold the purchase. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY to the
// project's public Apple API key. Without it (or in a simulator with no products) Plus simply can't be bought.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE, PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { DEBUG_TOOLS } from './debug';

export const PLUS_ENTITLEMENT = 'plus';
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

interface PlusState {
  // true once RevenueCat has answered (or there is nothing to ask)
  ready: boolean;
  active: boolean;
  // testing builds only (DEBUG_TOOLS): Settings can pretend Plus is on
  devOverride: boolean;
}

let state: PlusState = { ready: false, active: false, devOverride: false };
let configured = false;
const listeners = new Set<() => void>();

function setState(next: Partial<PlusState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function fromCustomerInfo(info: CustomerInfo): void {
  setState({ ready: true, active: PLUS_ENTITLEMENT in info.entitlements.active });
}

// whether purchases can work in this build at all
export function purchasesAvailable(): boolean {
  return Platform.OS === 'ios' && !!API_KEY;
}

// configure RevenueCat once at launch and follow entitlement changes (renewals, expiry, restores)
export function initPurchases(): void {
  if (configured) return;
  configured = true;
  if (!purchasesAvailable()) {
    setState({ ready: true });
    return;
  }
  try {
    Purchases.configure({ apiKey: API_KEY! });
    Purchases.addCustomerInfoUpdateListener(fromCustomerInfo);
    Purchases.getCustomerInfo()
      .then(fromCustomerInfo)
      .catch(() => setState({ ready: true }));
  } catch {
    setState({ ready: true });
  }
}

// testing builds only; ignored once DEBUG_TOOLS is off
export function setDevPlus(on: boolean): void {
  if (DEBUG_TOOLS && state.devOverride !== on) setState({ devOverride: on });
}

// Plus right now, outside React
export function isPlusNow(): boolean {
  return state.active || (DEBUG_TOOLS && state.devOverride);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// whether Plus is active; re-renders when it changes
export function usePlus(): boolean {
  // derive from the snapshot itself: the React Compiler caches a call with no reactive inputs, so returning
  // isPlusNow() here froze components mounted before Plus loaded (the theme sync) on "no Plus"
  const current = useSyncExternalStore(subscribe, () => state);
  return current.active || (DEBUG_TOOLS && current.devOverride);
}

export interface PlusOffer {
  annual: PurchasesPackage | null;
  monthly: PurchasesPackage | null;
}

// the current offering's yearly and monthly packages, or null when nothing can be bought
export async function getPlusOffer(): Promise<PlusOffer | null> {
  if (!purchasesAvailable()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    const find = (type: PACKAGE_TYPE) => current.availablePackages.find((p) => p.packageType === type) ?? null;
    const offer = { annual: current.annual ?? find(PACKAGE_TYPE.ANNUAL), monthly: current.monthly ?? find(PACKAGE_TYPE.MONTHLY) };
    return offer.annual || offer.monthly ? offer : null;
  } catch {
    return null;
  }
}

// buy a package; false when the user backs out, throws on a real failure
export async function buyPlus(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    fromCustomerInfo(customerInfo);
    return PLUS_ENTITLEMENT in customerInfo.entitlements.active;
  } catch (e) {
    if ((e as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
    throw e;
  }
}

// restore an earlier purchase on this Apple account; true when Plus came back
export async function restorePlus(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  const info = await Purchases.restorePurchases();
  fromCustomerInfo(info);
  return PLUS_ENTITLEMENT in info.entitlements.active;
}

// Apple's subscription management sheet
export async function manageSubscription(): Promise<void> {
  if (purchasesAvailable()) await Purchases.showManageSubscriptions();
}

// RevenueCat's id for this install, which the AI proxy uses to check Plus; null when purchases are off
export async function getInstallId(): Promise<string | null> {
  if (!purchasesAvailable()) return null;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}
