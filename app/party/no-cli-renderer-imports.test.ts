import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function sourceFilesUnder(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...sourceFilesUnder(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

describe("Party module imports", () => {
  it("does not depend on CLI rendering utilities", () => {
    const forbiddenImport = "cli/shared/" + "cli.renderer";
    const offenders = sourceFilesUnder("app/party")
      .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
      .filter((file) =>
        readFileSync(file, "utf8").includes(forbiddenImport)
      );

    expect(offenders.map((file) => relative(process.cwd(), file))).toEqual([]);
  });
});
