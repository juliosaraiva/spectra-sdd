import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolveSpectraPath } from "../core/config.js";
import { GenerateLockSchema, type GenerateLock, type LockEntry, type ContentHash } from "../core/spec-types.js";

async function loadLock(projectRoot: string): Promise<GenerateLock> {
  const lockPath = resolveSpectraPath(projectRoot, "generate.lock");
  try {
    const raw = await readFile(lockPath, "utf8");
    return GenerateLockSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveLock(
  projectRoot: string,
  lock: GenerateLock
): Promise<void> {
  const lockPath = resolveSpectraPath(projectRoot, "generate.lock");
  await writeFile(lockPath, JSON.stringify(lock, null, 2));
}

function lockKey(specId: string, specVersion: string, target: string): string {
  return `${specId}@${specVersion}--${target}`;
}

export function generateId(): string {
  return `gen:${randomBytes(4).toString("hex")}`;
}

export async function lockGeneration(
  projectRoot: string,
  specId: string,
  specVersion: string,
  target: string,
  entry: Omit<LockEntry, "generation_id" | "generated_at">
): Promise<LockEntry> {
  const lock = await loadLock(projectRoot);
  const key = lockKey(specId, specVersion, target);

  const fullEntry: LockEntry = {
    ...entry,
    generation_id: generateId(),
    generated_at: new Date().toISOString(),
  };

  lock[key] = fullEntry;
  await saveLock(projectRoot, lock);
  return fullEntry;
}

export async function isLocked(
  projectRoot: string,
  specId: string,
  specVersion: string,
  target: string,
  currentInputHash: ContentHash,
  currentTemplateHash: ContentHash
): Promise<boolean> {
  const lock = await loadLock(projectRoot);
  const key = lockKey(specId, specVersion, target);
  const entry = lock[key];

  if (!entry) return false;

  return (
    entry.input_spec_hash === currentInputHash &&
    entry.template_hash === currentTemplateHash
  );
}

export async function readLockEntry(
  projectRoot: string,
  specId: string,
  specVersion: string,
  target: string
): Promise<LockEntry | null> {
  const lock = await loadLock(projectRoot);
  const key = lockKey(specId, specVersion, target);
  return lock[key] ?? null;
}
