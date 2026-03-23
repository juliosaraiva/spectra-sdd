import { createHash } from "node:crypto";

/**
 * Recursively sorts object keys to produce a deterministic representation.
 * Strips the `hash` key at any level (it references itself).
 */
function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (key === "hash") continue; // self-referential — exclude
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Produces a canonical JSON string from an object.
 * Keys are sorted recursively, the `hash` field is stripped,
 * and the output is deterministic regardless of input key order.
 */
export function canonicalize(obj: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(obj));
}

/**
 * Computes SHA-256 of the canonical form of a YAML/JSON object.
 * Returns `sha256:<hex>`.
 */
export function contentHash(obj: Record<string, unknown>): string {
  const canonical = canonicalize(obj);
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `sha256:${hash}`;
}

/**
 * Verifies that an object's content hash matches the expected value.
 */
export function verifyHash(obj: Record<string, unknown>, expected: string): boolean {
  return contentHash(obj) === expected;
}
