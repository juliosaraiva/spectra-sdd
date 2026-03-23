import { readFile, writeFile } from "node:fs/promises";
import {
  TraceMatrixSchema,
  type TraceMatrix,
  type ContentHash,
  type SpecStatus,
} from "./spec-types.js";
import { resolveSpectraPath } from "./config.js";

export interface TraceAncestry {
  file: string;
  spec_id: string;
  spec_hash: ContentHash;
  impl_ref?: string;
  generation_id?: string;
  concern?: string;
}

export interface ACCoverageReport {
  spec_id: string;
  total_acs: number;
  covered_acs: number;
  coverage_percent: number;
  uncovered: string[];
}

async function loadTrace(projectRoot: string): Promise<TraceMatrix> {
  const tracePath = resolveSpectraPath(projectRoot, "trace.json");
  try {
    const raw = await readFile(tracePath, "utf8");
    return TraceMatrixSchema.parse(JSON.parse(raw));
  } catch {
    return {
      version: "1.0",
      updated_at: new Date().toISOString(),
      specs: {},
    };
  }
}

async function saveTrace(projectRoot: string, trace: TraceMatrix): Promise<void> {
  const tracePath = resolveSpectraPath(projectRoot, "trace.json");
  trace.updated_at = new Date().toISOString();
  await writeFile(tracePath, JSON.stringify(trace, null, 2));
}

export async function updateTrace(
  projectRoot: string,
  specId: string,
  specHash: ContentHash,
  status: SpecStatus,
  artifacts: Array<{
    path: string;
    hash: ContentHash;
    concern?: string;
    impl_ref?: string;
    generation_id?: string;
    type?: "source" | "test";
  }>
): Promise<void> {
  const trace = await loadTrace(projectRoot);

  if (!trace.specs[specId]) {
    trace.specs[specId] = {
      hash: specHash,
      status,
      authorized_artifacts: [],
      ac_coverage: {},
      gates: {},
    };
  }

  trace.specs[specId].hash = specHash;
  trace.specs[specId].status = status;
  trace.specs[specId].authorized_artifacts = artifacts.map((a) => ({
    path: a.path,
    hash: a.hash,
    concern: a.concern,
    impl_ref: a.impl_ref,
    generation_id: a.generation_id,
    type: a.type ?? "source",
  }));

  await saveTrace(projectRoot, trace);
}

export async function traceWhy(
  projectRoot: string,
  filePath: string
): Promise<TraceAncestry | null> {
  const trace = await loadTrace(projectRoot);

  for (const [specId, entry] of Object.entries(trace.specs)) {
    for (const artifact of entry.authorized_artifacts) {
      if (artifact.path === filePath) {
        return {
          file: filePath,
          spec_id: specId,
          spec_hash: entry.hash,
          impl_ref: artifact.impl_ref,
          generation_id: artifact.generation_id,
          concern: artifact.concern,
        };
      }
    }
  }

  return null;
}

export async function traceForward(
  projectRoot: string,
  specId: string
): Promise<TraceMatrix["specs"][string] | null> {
  const trace = await loadTrace(projectRoot);
  return trace.specs[specId] ?? null;
}

export async function computeCoverage(
  projectRoot: string,
  specId: string
): Promise<ACCoverageReport | null> {
  const trace = await loadTrace(projectRoot);
  const entry = trace.specs[specId];
  if (!entry) return null;

  const acIds = Object.keys(entry.ac_coverage);
  if (acIds.length === 0) return null;

  const covered = acIds.filter((id) => entry.ac_coverage[id].covered);
  const uncovered = acIds.filter((id) => !entry.ac_coverage[id].covered);

  return {
    spec_id: specId,
    total_acs: acIds.length,
    covered_acs: covered.length,
    coverage_percent: acIds.length > 0 ? Math.round((covered.length / acIds.length) * 100) : 0,
    uncovered,
  };
}

export async function updateGateInTrace(
  projectRoot: string,
  specId: string,
  phase: string,
  status: "pending" | "approved" | "rejected" | "expired"
): Promise<void> {
  const trace = await loadTrace(projectRoot);

  if (!trace.specs[specId]) {
    return; // spec not tracked yet
  }

  trace.specs[specId].gates[phase] = status;
  await saveTrace(projectRoot, trace);
}

export { loadTrace, saveTrace };
