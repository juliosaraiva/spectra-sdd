import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { FeatureSpecSchema, type SpecIndex, type IndexEntry } from "./spec-types.js";
import { resolveSpectraPath } from "./config.js";
import { contentHash } from "./hash.js";
import { isFeatureSpec, isImplSpec, readSpecFile } from "./spec-reader.js";

/**
 * Scans all feature spec files and rebuilds the _index.yaml for progressive disclosure.
 */
export async function rebuildIndex(projectRoot: string): Promise<SpecIndex> {
  const featuresDir = resolveSpectraPath(projectRoot, "features");
  const entries: IndexEntry[] = [];

  let files: string[];
  try {
    files = await readdir(featuresDir);
  } catch {
    files = [];
  }

  for (const file of files) {
    if (!isFeatureSpec(file)) continue;

    const filePath = join(featuresDir, file);
    const { parsed } = await readSpecFile(filePath);

    // Extract basic fields even if full validation fails (for drafts)
    const spectra = parsed?.spectra as Record<string, unknown> | undefined;
    const identity = parsed?.identity as Record<string, unknown> | undefined;
    if (!spectra?.id || !identity?.title) continue;

    const result = FeatureSpecSchema.safeParse(parsed);
    const spec = result.success ? result.data : null;
    const hash = spec?.hash?.content_hash ?? contentHash(parsed);

    const specId = spectra.id as string;
    const featureName = specId.replace(/^feat:/, "");

    // Count impl specs for this feature
    const implDir = resolveSpectraPath(projectRoot, "impl", featureName);
    let implCount = 0;
    try {
      const implFiles = await readdir(implDir);
      implCount = implFiles.filter((f) => isImplSpec(f)).length;
    } catch {
      // no impl dir yet
    }

    // Count test cases
    let testCount = 0;
    try {
      const testPath = resolveSpectraPath(projectRoot, "tests", `${featureName}.test.yaml`);
      const testRaw = await readFile(testPath, "utf8");
      const testParsed = parse(testRaw);
      testCount = testParsed?.test_cases?.length ?? 0;
    } catch {
      // no test spec yet
    }

    const acCount = spec
      ? spec.acceptance_criteria.length
      : Array.isArray(parsed.acceptance_criteria)
        ? parsed.acceptance_criteria.length
        : 0;

    entries.push({
      id: specId,
      title: identity.title as string,
      status: ((spectra.status as string) ?? "draft") as IndexEntry["status"],
      semver: (spectra.semver as string) ?? "0.0.0",
      domain: Array.isArray(identity.domain) ? (identity.domain as string[]) : [],
      summary: (identity.summary as string) ?? "",
      ac_count: acCount,
      impl_count: implCount,
      test_count: testCount,
      hash,
      file,
    });
  }

  const index: SpecIndex = {
    spectra_index: {
      version: "1.0",
      last_updated: new Date().toISOString(),
    },
    features: entries,
  };

  const indexPath = join(featuresDir, "_index.yaml");
  await writeFile(indexPath, stringify(index, { lineWidth: 120 }));

  return index;
}
