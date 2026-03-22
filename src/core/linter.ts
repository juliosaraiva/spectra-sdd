import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { FeatureSpecSchema, type FeatureSpec } from "./spec-types.js";
import { contentHash, verifyHash } from "./hash.js";
import { resolveSpectraPath } from "./config.js";
import { loadConstitution } from "./constitution.js";

export interface LintResult {
  rule: string;
  severity: "error" | "warning";
  message: string;
  location: string;
}

const VAGUE_WORDS = [
  "fast",
  "quick",
  "slow",
  "appropriate",
  "reasonable",
  "adequate",
  "sufficient",
  "significant",
  "considerable",
  "proper",
  "suitable",
  "good",
  "bad",
  "nice",
  "optimal",
  "efficient",
  "performant",
  "scalable",
  "robust",
  "secure",
  "reliable",
  "maintainable",
  "user-friendly",
];

const WEAK_MODALS = ["should", "may", "might", "could", "would", "can"];

function checkVagueLanguage(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const word of VAGUE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(lower)) found.push(word);
  }
  for (const modal of WEAK_MODALS) {
    const regex = new RegExp(`\\b${modal}\\b`, "i");
    if (regex.test(lower)) found.push(modal);
  }
  return found;
}

export function lintFeatureSpec(
  spec: FeatureSpec,
  filePath: string,
  constitutionVocabulary?: string[],
  rawParsed?: Record<string, unknown>
): LintResult[] {
  const results: LintResult[] = [];

  // SPEC-001: AC must have given/when/then
  for (const ac of spec.acceptance_criteria) {
    if (!ac.given || !ac.when || !ac.then || ac.then.length === 0) {
      results.push({
        rule: "SPEC-001",
        severity: "error",
        message: `Acceptance criterion ${ac.id} must have given, when, and then fields`,
        location: `${filePath}:acceptance_criteria.${ac.id}`,
      });
    }
  }

  // SPEC-002: No vague quantifiers
  for (const ac of spec.acceptance_criteria) {
    const allText = [ac.given, ac.when, ...ac.then].join(" ");
    const vague = checkVagueLanguage(allText);
    if (vague.length > 0) {
      results.push({
        rule: "SPEC-002",
        severity: "warning",
        message: `${ac.id} uses vague language: "${vague.join('", "')}". Use specific, measurable terms.`,
        location: `${filePath}:acceptance_criteria.${ac.id}`,
      });
    }
  }

  // SPEC-003: Interface schemas must be fully specified
  if (spec.interfaces) {
    for (const input of spec.interfaces.inputs) {
      const schemaStr = JSON.stringify(input.schema);
      if (schemaStr.includes('"any"') || schemaStr.includes('"unknown"')) {
        results.push({
          rule: "SPEC-003",
          severity: "error",
          message: `Input "${input.name}" schema contains "any" or "unknown" type. All types must be fully specified.`,
          location: `${filePath}:interfaces.inputs.${input.name}`,
        });
      }
    }
    for (const output of spec.interfaces.outputs) {
      const schemaStr = JSON.stringify(output.schema);
      if (schemaStr.includes('"any"') || schemaStr.includes('"unknown"')) {
        results.push({
          rule: "SPEC-003",
          severity: "error",
          message: `Output "${output.name}" schema contains "any" or "unknown" type. All types must be fully specified.`,
          location: `${filePath}:interfaces.outputs.${output.name}`,
        });
      }
    }
  }

  // SPEC-004: Non-functional requirements must have measurable thresholds
  if (spec.non_functional) {
    const nfr = spec.non_functional;
    const numberRegex = /\d+/;
    for (const perf of nfr.performance) {
      if (!numberRegex.test(perf)) {
        results.push({
          rule: "SPEC-004",
          severity: "warning",
          message: `Performance requirement lacks measurable threshold: "${perf}"`,
          location: `${filePath}:non_functional.performance`,
        });
      }
    }
  }

  // SPEC-005: Dependencies reference existing specs (checked separately via cross-ref validation)
  // This rule is a placeholder — actual cross-ref checking is in validator.ts

  // SPEC-006: Content hash is current
  if (spec.hash && rawParsed) {
    if (!verifyHash(rawParsed, spec.hash.content_hash)) {
      results.push({
        rule: "SPEC-006",
        severity: "error",
        message: `Content hash is stale. Run "spectra spec rehash" to update.`,
        location: `${filePath}:hash.content_hash`,
      });
    }
  }

  // SPEC-007: At least one AC must be non_negotiable
  const hasNonNegotiable = spec.acceptance_criteria.some(
    (ac) => ac.non_negotiable
  );
  if (!hasNonNegotiable) {
    results.push({
      rule: "SPEC-007",
      severity: "warning",
      message:
        "No acceptance criterion is marked non_negotiable. At least one should be.",
      location: `${filePath}:acceptance_criteria`,
    });
  }

  // SPEC-008: Domain tags must exist in constitution vocabulary
  if (constitutionVocabulary) {
    const vocabSet = new Set(constitutionVocabulary);
    for (const tag of spec.identity.domain) {
      if (!vocabSet.has(tag)) {
        results.push({
          rule: "SPEC-008",
          severity: "warning",
          message: `Domain tag "${tag}" not found in constitution vocabulary. Add it or use an existing term.`,
          location: `${filePath}:identity.domain`,
        });
      }
    }
  }

  return results;
}

export async function lintAll(projectRoot: string): Promise<LintResult[]> {
  const results: LintResult[] = [];

  // Load constitution vocabulary
  let vocabulary: string[] | undefined;
  try {
    const constitution = await loadConstitution(projectRoot);
    vocabulary = constitution.vocabulary;
  } catch {
    // no constitution
  }

  // Lint all feature specs
  try {
    const featDir = resolveSpectraPath(projectRoot, "features");
    const files = await readdir(featDir);
    for (const f of files) {
      if (!f.endsWith(".spec.yaml") && !f.endsWith(".spec.yml")) continue;
      const filePath = join(featDir, f);
      const raw = await readFile(filePath, "utf8");
      const parsed = parse(raw);
      const specResult = FeatureSpecSchema.safeParse(parsed);
      if (specResult.success) {
        results.push(
          ...lintFeatureSpec(specResult.data, filePath, vocabulary, parsed)
        );
      }
    }
  } catch {
    // no features dir
  }

  return results;
}
