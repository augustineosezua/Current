import js from "@eslint/js";
import tseslint from "typescript-eslint";

// purity guard: core takes data and `now` in, returns results, touches nothing else
const purityRules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: [
            "@prisma/*",
            "prisma",
            "pg",
            "expo-*",
            "react-native*",
            "node:*",
            "fs",
            "http",
            "https",
            "net",
            "axios",
            "plaid",
          ],
          message: "core is pure: no database, network, file or platform imports.",
        },
      ],
    },
  ],
  "no-restricted-globals": [
    "error",
    { name: "fetch", message: "core is pure: no network access." },
    { name: "XMLHttpRequest", message: "core is pure: no network access." },
    { name: "localStorage", message: "core is pure: no storage access." },
  ],
  "no-restricted-properties": [
    "error",
    { object: "Date", property: "now", message: "core is pure: pass `now` in." },
    { object: "Math", property: "random", message: "core is pure: no randomness." },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: "core is pure: pass `now` in instead of reading the clock.",
    },
  ],
};

export default tseslint.config(
  { ignores: ["node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.ts"], rules: purityRules },
);
