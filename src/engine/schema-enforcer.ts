import { parse } from "yaml";
import type { ZodType } from "zod";

export interface EnforcementResult {
  valid: boolean;
  parsed?: unknown;
  errors?: string[];
  attempts: number;
}

/**
 * Validates that a generated output string conforms to a Zod schema.
 * Attempts to parse as YAML first, then JSON.
 */
export function enforceSchema(output: string, schema: ZodType): EnforcementResult {
  let parsed: unknown;

  // Try YAML parsing first
  try {
    parsed = parse(output);
  } catch {
    // Try JSON
    try {
      parsed = JSON.parse(output);
    } catch {
      return {
        valid: false,
        errors: ["Output is neither valid YAML nor JSON"],
        attempts: 1,
      };
    }
  }

  // Validate against schema
  const result = schema.safeParse(parsed);
  if (result.success) {
    return { valid: true, parsed: result.data, attempts: 1 };
  }

  return {
    valid: false,
    parsed,
    errors: result.error.issues.map((i) => `[${i.path.join(".")}] ${i.message}`),
    attempts: 1,
  };
}
