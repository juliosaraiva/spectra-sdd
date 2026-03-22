import { readLockEntry } from "./lock.js";
import { generate } from "./generator.js";

export interface DeterminismResult {
  deterministic: boolean;
  spec_id: string;
  target: string;
  locked_hash?: string;
  regenerated_hash?: string;
  message: string;
}

/**
 * Verifies generation determinism by re-running generation
 * and comparing the output hash against the locked hash.
 */
export async function auditDeterminism(
  projectRoot: string,
  specId: string,
  specVersion: string,
  target: string
): Promise<DeterminismResult> {
  // Read lock entry
  const lockEntry = await readLockEntry(
    projectRoot,
    specId,
    specVersion,
    target
  );

  if (!lockEntry) {
    return {
      deterministic: false,
      spec_id: specId,
      target,
      message: `No lock entry found for ${specId}@${specVersion}--${target}`,
    };
  }

  // Re-run generation with force (bypass lock)
  const result = await generate(projectRoot, {
    templateId: lockEntry.template_id,
    specId,
    specVersion,
    target,
    force: true,
  });

  if (!result.success) {
    return {
      deterministic: false,
      spec_id: specId,
      target,
      locked_hash: lockEntry.output_hash,
      message: `Re-generation failed: ${result.error}`,
    };
  }

  const isDeterministic = result.output_hash === lockEntry.output_hash;

  return {
    deterministic: isDeterministic,
    spec_id: specId,
    target,
    locked_hash: lockEntry.output_hash,
    regenerated_hash: result.output_hash,
    message: isDeterministic
      ? "Output hash matches — generation is deterministic"
      : `Output hash mismatch — locked: ${lockEntry.output_hash}, regenerated: ${result.output_hash}`,
  };
}
