import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadTrace } from "./trace.js";

export interface DriftItem {
  type: "structural" | "semantic" | "constitutional";
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
  spec_id?: string;
}

export interface DriftReport {
  generated_at: string;
  project_drift_score: number;
  items: DriftItem[];
  features: Record<
    string,
    {
      status: "clean" | "drifted";
      drift_types: string[];
      items: DriftItem[];
    }
  >;
}

const TRACE_COMMENT_REGEX = /\/\/\s*@spectra\s+([\w:@.\-]+)\s*(impl:[\w.\-@]+)?\s*(gen:[\w]+)?/g;

/**
 * Scans source files for @spectra trace comments and compares
 * against the traceability matrix and current spec hashes.
 */
export async function detectStructuralDrift(
  projectRoot: string,
  srcDirs: string[] = ["src"]
): Promise<DriftItem[]> {
  const trace = await loadTrace(projectRoot);
  const items: DriftItem[] = [];

  for (const srcDir of srcDirs) {
    const fullDir = join(projectRoot, srcDir);
    try {
      await scanDirectory(fullDir, trace, items, projectRoot);
    } catch {
      // src dir doesn't exist
    }
  }

  // Check for active specs with no authorized artifacts
  for (const [specId, entry] of Object.entries(trace.specs)) {
    if (entry.status === "active" && entry.authorized_artifacts.length === 0) {
      items.push({
        type: "structural",
        severity: "warning",
        message: `Spec ${specId} is active but has no authorized artifacts`,
        spec_id: specId,
      });
    }
  }

  return items;
}

async function scanDirectory(
  dir: string,
  trace: Awaited<ReturnType<typeof loadTrace>>,
  items: DriftItem[],
  projectRoot: string
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await scanDirectory(fullPath, trace, items, projectRoot);
    } else if (
      entry.name.endsWith(".ts") ||
      entry.name.endsWith(".js") ||
      entry.name.endsWith(".tsx") ||
      entry.name.endsWith(".jsx") ||
      entry.name.endsWith(".py") ||
      entry.name.endsWith(".go") ||
      entry.name.endsWith(".rs") ||
      entry.name.endsWith(".java")
    ) {
      const content = await readFile(fullPath, "utf8");
      const relativePath = fullPath.replace(projectRoot + "/", "");

      let match;
      TRACE_COMMENT_REGEX.lastIndex = 0;
      while ((match = TRACE_COMMENT_REGEX.exec(content)) !== null) {
        const specRef = match[1];
        // Extract spec ID (without version) for lookup
        const specIdMatch = specRef.match(/^([\w:.\-]+)@/);
        const specId = specIdMatch ? specIdMatch[1] : specRef;

        const traceEntry = trace.specs[specId];
        if (!traceEntry) {
          items.push({
            type: "structural",
            severity: "warning",
            message: `File references spec "${specRef}" but no trace entry exists`,
            file: relativePath,
            spec_id: specId,
          });
          continue;
        }

        // Check if file is in authorized artifacts
        const isAuthorized = traceEntry.authorized_artifacts.some((a) => a.path === relativePath);
        if (!isAuthorized) {
          items.push({
            type: "structural",
            severity: "warning",
            message: `File references spec "${specRef}" but is not in the authorized artifacts list`,
            file: relativePath,
            spec_id: specId,
          });
        }
      }
    }
  }
}

/**
 * Detects semantic drift by checking test coverage against acceptance criteria.
 */
export function detectSemanticDrift(trace: Awaited<ReturnType<typeof loadTrace>>): DriftItem[] {
  const items: DriftItem[] = [];

  for (const [specId, entry] of Object.entries(trace.specs)) {
    if (entry.status !== "active") continue;

    for (const [acId, coverage] of Object.entries(entry.ac_coverage)) {
      if (!coverage.covered) {
        items.push({
          type: "semantic",
          severity: "warning",
          message: `Acceptance criterion ${acId} has no passing tests`,
          spec_id: specId,
        });
      }
    }
  }

  return items;
}

/**
 * Detects constitutional drift by verifying constraint enforcement.
 */
export function detectConstitutionalDrift(
  trace: Awaited<ReturnType<typeof loadTrace>>
): DriftItem[] {
  // Constitutional drift requires checking if tests that enforce
  // constitutional constraints have been removed or disabled.
  // For now, flag specs missing gates for completed phases.
  const items: DriftItem[] = [];

  for (const [specId, entry] of Object.entries(trace.specs)) {
    if (entry.status !== "active") continue;

    const gatePhases = Object.keys(entry.gates);
    if (gatePhases.length === 0) {
      items.push({
        type: "constitutional",
        severity: "warning",
        message: `Active spec ${specId} has no signed gates`,
        spec_id: specId,
      });
    }
  }

  return items;
}

export function computeDriftScore(items: DriftItem[]): number {
  if (items.length === 0) return 0;
  const errors = items.filter((i) => i.severity === "error").length;
  const warnings = items.filter((i) => i.severity === "warning").length;
  // Errors count 3x, warnings count 1x, normalize to 0-1
  const raw = (errors * 3 + warnings) / (items.length * 3);
  return Math.min(1, Math.round(raw * 100) / 100);
}

export async function generateDriftReport(projectRoot: string): Promise<DriftReport> {
  const trace = await loadTrace(projectRoot);

  const structural = await detectStructuralDrift(projectRoot);
  const semantic = detectSemanticDrift(trace);
  const constitutional = detectConstitutionalDrift(trace);

  const allItems = [...structural, ...semantic, ...constitutional];

  // Group by feature
  const features: DriftReport["features"] = {};
  for (const item of allItems) {
    const specId = item.spec_id ?? "unknown";
    if (!features[specId]) {
      features[specId] = { status: "clean", drift_types: [], items: [] };
    }
    features[specId].status = "drifted";
    if (!features[specId].drift_types.includes(item.type)) {
      features[specId].drift_types.push(item.type);
    }
    features[specId].items.push(item);
  }

  return {
    generated_at: new Date().toISOString(),
    project_drift_score: computeDriftScore(allItems),
    items: allItems,
    features,
  };
}
