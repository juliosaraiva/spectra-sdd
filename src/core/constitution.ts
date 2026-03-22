import { readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import {
  ConstitutionSchema,
  type Constitution,
  type Constraint,
} from "./spec-types.js";
import { spectraDir } from "./config.js";

export async function loadConstitution(
  projectRoot: string
): Promise<Constitution> {
  const path = join(spectraDir(projectRoot), "constitution.yaml");
  const raw = await readFile(path, "utf8");
  const parsed = parse(raw);
  return ConstitutionSchema.parse(parsed);
}

/**
 * Selects the most relevant constitutional constraints for a given set of domain tags.
 * Returns at most `maxCount` constraints (default 5), ranked by domain tag overlap.
 * This implements the CSDD research finding: 3-5 constraints per request = 96% compliance.
 */
export function selectConstraints(
  constitution: Constitution,
  domainTags: string[],
  maxCount = 5
): Constraint[] {
  const tagSet = new Set(domainTags);

  const scored = constitution.constraints.map((constraint) => {
    const overlap = constraint.domain.filter((d) => tagSet.has(d)).length;
    // MUST constraints get priority boost
    const enforcementBoost =
      constraint.enforcement === "MUST"
        ? 2
        : constraint.enforcement === "SHOULD"
          ? 1
          : 0;
    return { constraint, score: overlap + enforcementBoost };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, maxCount)
    .map((s) => s.constraint);
}

/**
 * Validates a feature spec's acceptance criteria against constitutional constraints.
 * Returns an array of violation messages.
 */
export function validateAgainstConstitution(
  spec: { acceptance_criteria: Array<{ id: string; constitution_constraints?: string[] }> },
  constitution: Constitution
): string[] {
  const violations: string[] = [];
  const constraintIds = new Set(constitution.constraints.map((c) => c.id));

  for (const ac of spec.acceptance_criteria) {
    if (ac.constitution_constraints) {
      for (const ref of ac.constitution_constraints) {
        if (!constraintIds.has(ref)) {
          violations.push(
            `${ac.id}: references unknown constitutional constraint "${ref}"`
          );
        }
      }
    }
  }

  return violations;
}

/**
 * Appends an amendment entry to the constitution changelog.
 */
export async function amendConstitution(
  projectRoot: string,
  amendment: {
    action: string;
    author: string;
    description: string;
    approved_by: string[];
    prev_hash: string;
    new_hash: string;
  }
): Promise<void> {
  const changelogPath = join(
    spectraDir(projectRoot),
    "constitution.changelog"
  );
  const entry = `${new Date().toISOString()} | ${amendment.action} | ${amendment.author} | ${amendment.description} | prev:${amendment.prev_hash} | new:${amendment.new_hash} | approved_by:${amendment.approved_by.join(",")}\n`;
  await appendFile(changelogPath, entry);
}

export function defaultConstitution(): Constitution {
  return {
    spectra: {
      version: "1.0",
      type: "constitution",
      semver: "1.0.0",
      updated: new Date().toISOString(),
      stewards: ["@team"],
    },
    vocabulary: [
      "identity",
      "security",
      "persistence",
      "transport",
      "observability",
      "auth",
      "api",
      "ui",
      "integration",
      "infrastructure",
    ],
    constraints: [
      {
        id: "SEC-001",
        title: "No secrets in source code",
        description:
          "API keys, passwords, tokens, and other secrets must never appear in source files. Use environment variables or secret management systems.",
        domain: ["security"],
        enforcement: "MUST",
      },
      {
        id: "SEC-002",
        title: "Validate all external inputs",
        description:
          "All data from external sources (user input, APIs, files) must be validated before processing.",
        domain: ["security", "api", "transport"],
        enforcement: "MUST",
      },
      {
        id: "ARCH-001",
        title: "Single responsibility per module",
        description:
          "Each module, class, or function should have one clear responsibility. Avoid god objects and mixed concerns.",
        domain: [
          "architecture",
          "persistence",
          "transport",
          "identity",
          "observability",
        ],
        enforcement: "SHOULD",
      },
      {
        id: "QUAL-001",
        title: "Acceptance criteria for public interfaces",
        description:
          "Every public API endpoint, event, or exported function must have corresponding acceptance criteria in its feature spec.",
        domain: ["api", "transport", "integration"],
        enforcement: "MUST",
      },
      {
        id: "QUAL-002",
        title: "Critical paths must be tested",
        description:
          "All code paths in critical business logic must have corresponding test coverage.",
        domain: ["security", "identity", "persistence"],
        enforcement: "MUST",
      },
    ],
  };
}

export function constitutionToYaml(constitution: Constitution): string {
  return stringify(constitution, { lineWidth: 120 });
}
