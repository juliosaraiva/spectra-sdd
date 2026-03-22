import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import {
  GateSchema,
  type Gate,
  type Phase,
  PHASE_ORDER,
  type ContentHash,
} from "./spec-types.js";
import { resolveSpectraPath } from "./config.js";

function gateFileName(specId: string, specSemver: string, phase: Phase): string {
  const safeId = specId.replace(/:/g, "_");
  return `${safeId}@${specSemver}--${phase}.gate.yaml`;
}

export async function createGate(
  projectRoot: string,
  specId: string,
  specSemver: string,
  specHash: ContentHash,
  phase: Phase
): Promise<Gate> {
  const gate: Gate = {
    gate: {
      spec_id: specId,
      spec_semver: specSemver,
      spec_hash: specHash,
      phase,
      status: "pending",
    },
    approval: undefined,
    artifacts_reviewed: [],
    expiry: {
      expires_if_spec_changes: true,
      manual_expiry: null,
    },
  };

  const gatesDir = resolveSpectraPath(projectRoot, "gates");
  const fileName = gateFileName(specId, specSemver, phase);
  await writeFile(join(gatesDir, fileName), stringify(gate, { lineWidth: 120 }));

  return gate;
}

export async function signGate(
  projectRoot: string,
  specId: string,
  specSemver: string,
  specHash: ContentHash,
  phase: Phase,
  signer: string,
  method: "cli" | "github-pr" | "linear-issue" | "api" = "cli",
  comment?: string
): Promise<Gate> {
  const gate: Gate = {
    gate: {
      spec_id: specId,
      spec_semver: specSemver,
      spec_hash: specHash,
      phase,
      status: "approved",
    },
    approval: {
      approved_by: signer,
      approved_at: new Date().toISOString(),
      method,
      comment,
    },
    artifacts_reviewed: [],
    expiry: {
      expires_if_spec_changes: true,
      manual_expiry: null,
    },
  };

  const gatesDir = resolveSpectraPath(projectRoot, "gates");
  const fileName = gateFileName(specId, specSemver, phase);
  await writeFile(join(gatesDir, fileName), stringify(gate, { lineWidth: 120 }));

  return gate;
}

export interface GateVerification {
  valid: boolean;
  gate: Gate | null;
  reason?: string;
}

export async function verifyGate(
  projectRoot: string,
  specId: string,
  phase: Phase,
  currentSpecHash: ContentHash
): Promise<GateVerification> {
  const gatesDir = resolveSpectraPath(projectRoot, "gates");

  let files: string[];
  try {
    files = await readdir(gatesDir);
  } catch {
    return { valid: false, gate: null, reason: "No gates directory" };
  }

  const safeId = specId.replace(/:/g, "_");
  const matching = files.filter(
    (f) => f.startsWith(safeId) && f.includes(`--${phase}.gate.yaml`)
  );

  if (matching.length === 0) {
    return { valid: false, gate: null, reason: `No gate found for ${specId} phase ${phase}` };
  }

  // Use the latest matching gate
  const latest = matching.sort().pop()!;
  const raw = await readFile(join(gatesDir, latest), "utf8");
  const parsed = parse(raw);
  const result = GateSchema.safeParse(parsed);

  if (!result.success) {
    return { valid: false, gate: null, reason: "Gate file is malformed" };
  }

  const gate = result.data;

  if (gate.gate.status !== "approved") {
    return { valid: false, gate, reason: `Gate status is "${gate.gate.status}", not approved` };
  }

  // Check hash binding — gate expires if spec changed
  if (gate.expiry.expires_if_spec_changes && gate.gate.spec_hash !== currentSpecHash) {
    return {
      valid: false,
      gate,
      reason: `Gate hash ${gate.gate.spec_hash} does not match current spec hash ${currentSpecHash}. Spec was modified after gate was signed.`,
    };
  }

  return { valid: true, gate };
}

export async function expireGatesForSpec(
  projectRoot: string,
  specId: string
): Promise<number> {
  const gatesDir = resolveSpectraPath(projectRoot, "gates");
  let expired = 0;

  let files: string[];
  try {
    files = await readdir(gatesDir);
  } catch {
    return 0;
  }

  const safeId = specId.replace(/:/g, "_");
  for (const f of files) {
    if (!f.startsWith(safeId) || !f.endsWith(".gate.yaml")) continue;

    const filePath = join(gatesDir, f);
    const raw = await readFile(filePath, "utf8");
    const parsed = parse(raw);
    const result = GateSchema.safeParse(parsed);
    if (!result.success) continue;

    const gate = result.data;
    if (gate.gate.status === "approved") {
      gate.gate.status = "expired";
      await writeFile(filePath, stringify(gate, { lineWidth: 120 }));
      expired++;
    }
  }

  return expired;
}

export async function listGates(
  projectRoot: string,
  specId?: string
): Promise<Gate[]> {
  const gatesDir = resolveSpectraPath(projectRoot, "gates");
  const gates: Gate[] = [];

  let files: string[];
  try {
    files = await readdir(gatesDir);
  } catch {
    return [];
  }

  for (const f of files) {
    if (!f.endsWith(".gate.yaml")) continue;
    if (specId) {
      const safeId = specId.replace(/:/g, "_");
      if (!f.startsWith(safeId)) continue;
    }

    const raw = await readFile(join(gatesDir, f), "utf8");
    const parsed = parse(raw);
    const result = GateSchema.safeParse(parsed);
    if (result.success) gates.push(result.data);
  }

  return gates;
}

export interface PhaseReadiness {
  ready: boolean;
  missing: Phase[];
}

export function checkPhaseReady(
  targetPhase: Phase,
  signedPhases: Phase[]
): PhaseReadiness {
  const targetIndex = PHASE_ORDER.indexOf(targetPhase);
  const missing: Phase[] = [];

  for (let i = 0; i < targetIndex; i++) {
    if (!signedPhases.includes(PHASE_ORDER[i])) {
      missing.push(PHASE_ORDER[i]);
    }
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}
