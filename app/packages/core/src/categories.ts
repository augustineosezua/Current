import type { CategoryKind } from "./types";

// the sticker palette; each name is a cat-* design token in the app
export const CATEGORY_COLORS = [
  "peach",
  "mint",
  "sky",
  "pink",
  "lilac",
  "butter",
  "aqua",
  "sand",
  "sage",
  "coral",
  "lavender",
  "stone",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface DefaultCategory {
  // fixed id, so two devices seeding the same defaults converge on one row when sync arrives
  id: string;
  name: string;
  emoji: string;
  color: CategoryColor;
  kind: CategoryKind;
  sortOrder: number;
}

const defaults: readonly Omit<DefaultCategory, "sortOrder">[] = [
  { id: "default-groceries", name: "Groceries", emoji: "🛒", color: "sage", kind: "needs" },
  { id: "default-eating-out", name: "Eating out", emoji: "🍔", color: "peach", kind: "wants" },
  { id: "default-coffee", name: "Coffee", emoji: "☕", color: "sand", kind: "wants" },
  { id: "default-transit", name: "Transit", emoji: "🚌", color: "sky", kind: "needs" },
  { id: "default-home", name: "Rent & bills", emoji: "🏠", color: "butter", kind: "needs" },
  { id: "default-school", name: "School", emoji: "📚", color: "lavender", kind: "needs" },
  { id: "default-health", name: "Health", emoji: "💊", color: "aqua", kind: "needs" },
  { id: "default-fun", name: "Fun", emoji: "🎉", color: "pink", kind: "wants" },
  { id: "default-shopping", name: "Shopping", emoji: "🛍️", color: "coral", kind: "wants" },
  { id: "default-subscriptions", name: "Subscriptions", emoji: "📺", color: "lilac", kind: "wants" },
  { id: "default-savings", name: "Savings", emoji: "🐷", color: "stone", kind: "savings" },
  { id: "default-income", name: "Income", emoji: "💸", color: "mint", kind: "income" },
];

// the categories every new install starts with; the user can rename, restyle or delete any of them
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = defaults.map((c, sortOrder) => ({ ...c, sortOrder }));

export type Storefront = "CA" | "US" | "GB" | "OTHER";

// region of a locale tag such as "en-CA", "fr_CA" or "en-Latn-GB"
export function storefrontFromLocale(locale: string | null | undefined): Storefront {
  const parts = (locale ?? "").split(/[-_]/).slice(1);
  const region = parts.find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  if (region === "CA" || region === "US" || region === "GB") return region;
  return "OTHER";
}

// merchant or everyday word -> default category id
export type MerchantSeeds = Readonly<Record<string, string>>;

// one category's worth of seed names
function seeds(categoryId: string, names: readonly string[]): [string, string][] {
  return names.map((n) => [n, categoryId]);
}

const GLOBAL_SEEDS: [string, string][] = [
  ...seeds("default-groceries", ["groceries", "grocery", "walmart", "costco"]),
  ...seeds("default-eating-out", [
    "lunch",
    "dinner",
    "breakfast",
    "takeout",
    "pizza",
    "mcdonalds",
    "mcdonald's",
    "subway",
    "kfc",
    "burger king",
    "uber eats",
    "doordash",
  ]),
  ...seeds("default-coffee", ["coffee", "starbucks"]),
  ...seeds("default-transit", ["bus", "train", "gas", "parking", "uber", "lyft"]),
  ...seeds("default-home", ["rent", "phone", "phone bill", "internet", "hydro", "electricity", "utilities"]),
  ...seeds("default-school", ["tuition", "textbook", "textbooks", "books", "printing"]),
  ...seeds("default-health", ["pharmacy", "gym", "dentist", "doctor"]),
  ...seeds("default-fun", ["movie", "movies", "bar", "drinks", "concert"]),
  ...seeds("default-shopping", ["amazon", "clothes", "ikea"]),
  ...seeds("default-subscriptions", ["netflix", "spotify", "disney plus", "youtube premium", "apple music", "icloud"]),
  ...seeds("default-income", ["paycheque", "paycheck", "pay", "salary", "wages"]),
];

const STOREFRONT_SEEDS: Record<Storefront, [string, string][]> = {
  CA: [
    ...seeds("default-groceries", ["loblaws", "no frills", "metro", "sobeys", "freshco", "food basics", "superstore"]),
    ...seeds("default-eating-out", ["pizza pizza", "harveys", "a&w", "skip the dishes"]),
    ...seeds("default-coffee", ["tim hortons", "tims"]),
    ...seeds("default-transit", ["presto", "ttc", "go transit", "oc transpo", "translink", "compass", "stm"]),
    ...seeds("default-home", ["rogers", "bell", "fido", "koodo", "telus", "freedom mobile"]),
    ...seeds("default-health", ["shoppers drug mart", "shoppers", "rexall"]),
    ...seeds("default-fun", ["lcbo", "beer store", "cineplex"]),
    ...seeds("default-shopping", ["dollarama", "canadian tire", "winners"]),
    ...seeds("default-income", ["osap"]),
  ],
  US: [
    ...seeds("default-groceries", ["trader joes", "trader joe's", "kroger", "safeway", "whole foods", "aldi", "publix"]),
    ...seeds("default-eating-out", ["chipotle", "taco bell", "chick fil a", "wendys", "panera"]),
    ...seeds("default-coffee", ["dunkin"]),
    ...seeds("default-transit", ["mta", "metrocard", "bart", "amtrak"]),
    ...seeds("default-home", ["verizon", "t mobile", "xfinity"]),
    ...seeds("default-health", ["cvs", "walgreens"]),
    ...seeds("default-shopping", ["target", "dollar tree"]),
    ...seeds("default-income", ["financial aid", "refund"]),
  ],
  GB: [
    ...seeds("default-groceries", ["tesco", "sainsburys", "sainsbury's", "asda", "aldi", "lidl", "morrisons", "co op"]),
    ...seeds("default-eating-out", ["greggs", "pret", "nandos", "deliveroo", "just eat"]),
    ...seeds("default-coffee", ["costa"]),
    ...seeds("default-transit", ["tfl", "oyster", "trainline", "national rail", "railcard"]),
    ...seeds("default-home", ["ee", "o2", "vodafone", "giffgaff"]),
    ...seeds("default-health", ["boots", "superdrug"]),
    ...seeds("default-fun", ["wetherspoons", "spoons", "odeon"]),
    ...seeds("default-shopping", ["primark", "argos"]),
    ...seeds("default-income", ["maintenance loan", "student finance"]),
  ],
  OTHER: [],
};

// built-in suggestions for a storefront, used until the user's own history takes over
export function getMerchantSeeds(storefront: Storefront): MerchantSeeds {
  return Object.fromEntries([...GLOBAL_SEEDS, ...STOREFRONT_SEEDS[storefront]]);
}
