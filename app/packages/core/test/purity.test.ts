import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(import.meta.dirname, "..", "src");
const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));

describe("core purity", () => {
  it.each(files)("%s has no database, network, file or clock access", (file) => {
    const source = readFileSync(join(srcDir, file), "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const spec of imports) expect(spec, `${file} imports ${spec}`).toMatch(/^\.\//);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/new Date\(\s*\)/);
  });
});
