import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { ZodError, type ZodType } from "zod";
import {
  FeatureSpecSchema,
  ImplSpecSchema,
  TestSpecSchema,
  MigrationSpecSchema,
  ConstitutionSchema,
  GateSchema,
} from "./spec-types.js";
import { resolveSpectraPath } from "./config.js";

export interface ValidationResult {
  file: string;
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

function zodToErrors(file: string, err: ZodError): ValidationError[] {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    severity: "error" as const,
  }));
}

function detectSpecType(
  parsed: Record<string, unknown>
): string | null {
  const spectra = parsed.spectra as Record<string, unknown> | undefined;
  if (!spectra?.type) {
    // Check if it's a constitution (no spectra.type wrapper in our schema)
    if (parsed.vocabulary && parsed.constraints) return "constitution";
    return null;
  }
  return spectra.type as string;
}

export async function validateSpec(filePath: string): Promise<ValidationResult> {
  const raw = await readFile(filePath, "utf8");
  const parsed = parse(raw);

  if (!parsed || typeof parsed !== "object") {
    return {
      file: filePath,
      valid: false,
      errors: [{ path: "", message: "File is not valid YAML", severity: "error" }],
    };
  }

  const specType = detectSpecType(parsed as Record<string, unknown>);

  const schemaMap: Record<string, ZodType> = {
    feature: FeatureSpecSchema,
    impl: ImplSpecSchema,
    test: TestSpecSchema,
    migration: MigrationSpecSchema,
    constitution: ConstitutionSchema,
    gate: GateSchema,
  };

  // Detect type from filename if not in content
  let effectiveType = specType;
  if (!effectiveType) {
    if (filePath.includes(".spec.")) effectiveType = "feature";
    else if (filePath.includes(".impl.")) effectiveType = "impl";
    else if (filePath.includes(".test.")) effectiveType = "test";
    else if (filePath.includes(".migration.")) effectiveType = "migration";
    else if (filePath.includes(".gate.")) effectiveType = "gate";
    else if (filePath.includes("constitution")) effectiveType = "constitution";
  }

  if (!effectiveType || !schemaMap[effectiveType]) {
    return {
      file: filePath,
      valid: false,
      errors: [
        {
          path: "spectra.type",
          message: `Unknown or missing spec type: ${effectiveType}`,
          severity: "error",
        },
      ],
    };
  }

  const schema = schemaMap[effectiveType];
  const result = schema.safeParse(parsed);

  if (result.success) {
    return { file: filePath, valid: true, errors: [] };
  }

  return {
    file: filePath,
    valid: false,
    errors: zodToErrors(filePath, result.error),
  };
}

export async function validateAll(
  projectRoot: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Validate constitution
  try {
    const constPath = resolveSpectraPath(projectRoot, "constitution.yaml");
    results.push(await validateSpec(constPath));
  } catch {
    // no constitution
  }

  // Validate features
  try {
    const featDir = resolveSpectraPath(projectRoot, "features");
    const files = await readdir(featDir);
    for (const f of files) {
      if (f.startsWith("_") || (!f.endsWith(".spec.yaml") && !f.endsWith(".spec.yml")))
        continue;
      results.push(await validateSpec(join(featDir, f)));
    }
  } catch {
    // no features dir
  }

  // Validate impl specs
  try {
    const implDir = resolveSpectraPath(projectRoot, "impl");
    const featDirs = await readdir(implDir);
    for (const fd of featDirs) {
      const implSubDir = join(implDir, fd);
      try {
        const implFiles = await readdir(implSubDir);
        for (const f of implFiles) {
          if (f.endsWith(".impl.yaml") || f.endsWith(".impl.yml")) {
            results.push(await validateSpec(join(implSubDir, f)));
          }
        }
      } catch {
        // not a directory
      }
    }
  } catch {
    // no impl dir
  }

  return results;
}

export async function validateCrossRefs(
  projectRoot: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Load all feature spec IDs
  const featureIds = new Set<string>();
  try {
    const featDir = resolveSpectraPath(projectRoot, "features");
    const files = await readdir(featDir);
    for (const f of files) {
      if (!f.endsWith(".spec.yaml") && !f.endsWith(".spec.yml")) continue;
      const raw = await readFile(join(featDir, f), "utf8");
      const parsed = parse(raw);
      if (parsed?.spectra?.id) featureIds.add(parsed.spectra.id);
    }
  } catch {
    // no features
  }

  // Check impl specs reference valid features
  try {
    const implDir = resolveSpectraPath(projectRoot, "impl");
    const featDirs = await readdir(implDir);
    for (const fd of featDirs) {
      const implSubDir = join(implDir, fd);
      try {
        const implFiles = await readdir(implSubDir);
        for (const f of implFiles) {
          if (!f.endsWith(".impl.yaml") && !f.endsWith(".impl.yml")) continue;
          const raw = await readFile(join(implSubDir, f), "utf8");
          const parsed = parse(raw);
          const featureRef = parsed?.spectra?.feature_ref;
          if (featureRef && !featureIds.has(featureRef)) {
            results.push({
              file: join(implSubDir, f),
              valid: false,
              errors: [
                {
                  path: "spectra.feature_ref",
                  message: `References unknown feature spec: ${featureRef}`,
                  severity: "error",
                },
              ],
            });
          }
        }
      } catch {
        // not a directory
      }
    }
  } catch {
    // no impl dir
  }

  return results;
}
