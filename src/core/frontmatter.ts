import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import type { AcceptanceCriterion, FeatureSpec, ImplSpec } from "./spec-types.js";

// ─── Frontmatter Parsing ────────────────────────────────────────────────────

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedFrontmatter {
  meta: Record<string, unknown>;
  body: string;
}

/**
 * Splits a Markdown+Frontmatter string into its YAML metadata and Markdown body.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error("File does not contain valid YAML frontmatter (expected --- delimiters)");
  }
  const meta = yamlParse(match[1]);
  if (!meta || typeof meta !== "object") {
    throw new Error("Frontmatter is not a valid YAML object");
  }
  return { meta: meta as Record<string, unknown>, body: match[2] };
}

// ─── Markdown AC Parsing ────────────────────────────────────────────────────

const AC_HEADING_REGEX = /^##\s+(AC-\d{3}):\s*(.+)$/;
const GIVEN_REGEX = /^\*\*Given\*\*\s+(.+)$/;
const WHEN_REGEX = /^\*\*When\*\*\s+(.+)$/;
const THEN_REGEX = /^\*\*Then:\*\*\s*$/;
const THEN_INLINE_REGEX = /^\*\*Then\*\*\s+(.+)$/;
const LIST_ITEM_REGEX = /^-\s+(.+)$/;
const BLOCKQUOTE_REGEX = /^>\s*(.+)$/;

interface ACMetadata {
  non_negotiable: boolean;
  constitution_constraints?: string[];
}

function parseACMetadata(line: string): ACMetadata {
  const result: ACMetadata = { non_negotiable: false };

  // Parse "non_negotiable: true" or "non_negotiable: false"
  const nnMatch = line.match(/non_negotiable:\s*(true|false)/);
  if (nnMatch) {
    result.non_negotiable = nnMatch[1] === "true";
  }

  // Parse "constitution_constraints: SEC-001, SEC-002" or "[SEC-001, SEC-002]"
  const ccMatch = line.match(/constitution_constraints:\s*\[?([^\]]+)\]?/);
  if (ccMatch) {
    result.constitution_constraints = ccMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return result;
}

/**
 * Parses Markdown body into an array of AcceptanceCriterion objects.
 *
 * Expected format per AC:
 * ```
 * ## AC-001: Title
 *
 * > non_negotiable: true | constitution_constraints: [SEC-001]
 *
 * **Given** some precondition
 * **When** some action
 * **Then:**
 * - outcome 1
 * - outcome 2
 * ```
 */
export function parseMarkdownACs(body: string): AcceptanceCriterion[] {
  const lines = body.split(/\r?\n/);
  const criteria: AcceptanceCriterion[] = [];
  let current: Partial<AcceptanceCriterion> | null = null;
  let collectingThen = false;
  let thenItems: string[] = [];
  let metadata: ACMetadata = { non_negotiable: false };

  function flushCurrent() {
    if (current?.id && current.title && current.given && current.when && thenItems.length > 0) {
      const ac: AcceptanceCriterion = {
        id: current.id,
        title: current.title,
        given: current.given,
        when: current.when,
        then: thenItems,
        non_negotiable: metadata.non_negotiable,
      };
      if (metadata.constitution_constraints && metadata.constitution_constraints.length > 0) {
        ac.constitution_constraints = metadata.constitution_constraints;
      }
      criteria.push(ac);
    }
    current = null;
    collectingThen = false;
    thenItems = [];
    metadata = { non_negotiable: false };
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Check for new AC heading
    const headingMatch = line.match(AC_HEADING_REGEX);
    if (headingMatch) {
      flushCurrent();
      current = { id: headingMatch[1], title: headingMatch[2].trim() };
      continue;
    }

    if (!current) continue;

    // Parse blockquote metadata (> non_negotiable: true | constitution_constraints: ...)
    const bqMatch = line.match(BLOCKQUOTE_REGEX);
    if (bqMatch) {
      const parsed = parseACMetadata(bqMatch[1]);
      metadata.non_negotiable = parsed.non_negotiable;
      if (parsed.constitution_constraints) {
        metadata.constitution_constraints = parsed.constitution_constraints;
      }
      continue;
    }

    // Parse Given
    const givenMatch = line.match(GIVEN_REGEX);
    if (givenMatch) {
      collectingThen = false;
      current.given = givenMatch[1].trim();
      continue;
    }

    // Parse When
    const whenMatch = line.match(WHEN_REGEX);
    if (whenMatch) {
      collectingThen = false;
      current.when = whenMatch[1].trim();
      continue;
    }

    // Parse Then: (block header)
    if (THEN_REGEX.test(line)) {
      collectingThen = true;
      continue;
    }

    // Parse single-line Then (no colon)
    const thenInlineMatch = line.match(THEN_INLINE_REGEX);
    if (thenInlineMatch) {
      collectingThen = true;
      thenItems.push(thenInlineMatch[1].trim());
      continue;
    }

    // Collect list items when in Then mode
    if (collectingThen) {
      const listMatch = line.match(LIST_ITEM_REGEX);
      if (listMatch) {
        thenItems.push(listMatch[1].trim());
        continue;
      }
      // Empty line: keep collecting (allow blank lines between list items)
      if (line.trim() === "") continue;
      // Non-empty, non-list line: stop collecting Then items
      collectingThen = false;
    }
  }

  // Flush last AC
  flushCurrent();

  return criteria;
}

// ─── Spec Parsing ───────────────────────────────────────────────────────────

/**
 * Parses a Markdown+Frontmatter feature spec into the same object shape
 * as a YAML feature spec (for Zod validation, hashing, etc.)
 */
export function parseFeatureSpecMd(raw: string): Record<string, unknown> {
  const { meta, body } = parseFrontmatter(raw);
  const acceptanceCriteria = parseMarkdownACs(body);

  return {
    ...meta,
    acceptance_criteria: acceptanceCriteria,
  };
}

/**
 * Parses a Markdown+Frontmatter impl spec. The body is stored as the `design`
 * field (as a single `description` string) so the object shape matches ImplSpecSchema.
 */
export function parseImplSpecMd(raw: string): Record<string, unknown> {
  const { meta, body } = parseFrontmatter(raw);

  return {
    ...meta,
    design: { description: body.trim() || "TODO" },
  };
}

// ─── Serialization ──────────────────────────────────────────────────────────

function renderACToMarkdown(ac: AcceptanceCriterion): string {
  const lines: string[] = [];

  lines.push(`## ${ac.id}: ${ac.title}`);
  lines.push("");

  // Metadata blockquote
  const metaParts: string[] = [];
  metaParts.push(`non_negotiable: ${ac.non_negotiable}`);
  if (ac.constitution_constraints && ac.constitution_constraints.length > 0) {
    metaParts.push(`constitution_constraints: [${ac.constitution_constraints.join(", ")}]`);
  }
  lines.push(`> ${metaParts.join(" | ")}`);
  lines.push("");

  lines.push(`**Given** ${ac.given}`);
  lines.push(`**When** ${ac.when}`);
  lines.push("**Then:**");
  for (const t of ac.then) {
    lines.push(`- ${t}`);
  }

  return lines.join("\n");
}

/**
 * Serializes a FeatureSpec to Markdown+Frontmatter format.
 * The frontmatter contains all structured metadata.
 * The body contains acceptance criteria as Markdown sections.
 */
export function serializeFeatureSpec(spec: FeatureSpec): string {
  // Build frontmatter object — everything except acceptance_criteria
  const frontmatter: Record<string, unknown> = {
    spectra: spec.spectra,
    identity: spec.identity,
  };
  if (spec.interfaces) frontmatter.interfaces = spec.interfaces;
  if (spec.non_functional) frontmatter.non_functional = spec.non_functional;
  if (spec.dependencies) frontmatter.dependencies = spec.dependencies;
  if (spec.hash) frontmatter.hash = spec.hash;

  const yamlStr = yamlStringify(frontmatter, { lineWidth: 120 }).trimEnd();

  // Build body
  const title = spec.identity.title;
  const summary = spec.identity.summary;
  const acBlocks = spec.acceptance_criteria.map(renderACToMarkdown);

  const body = [`# ${title}`, "", summary, "", ...acBlocks.flatMap((block) => [block, ""])].join(
    "\n"
  );

  return `---\n${yamlStr}\n---\n\n${body}`;
}

/**
 * Serializes an ImplSpec to Markdown+Frontmatter format.
 * The frontmatter contains spectra metadata.
 * The body contains the design content.
 */
export function serializeImplSpec(impl: ImplSpec, designBody?: string): string {
  const frontmatter: Record<string, unknown> = {
    spectra: impl.spectra,
  };

  const yamlStr = yamlStringify(frontmatter, { lineWidth: 120 }).trimEnd();

  // Use provided designBody, or serialize the design object if it has only a description string
  let body: string;
  if (designBody) {
    body = designBody;
  } else if (typeof impl.design.description === "string") {
    body = impl.design.description;
  } else {
    // For complex design objects, render as YAML code block in the body
    const designYaml = yamlStringify(impl.design, { lineWidth: 120 }).trimEnd();
    const concern = impl.spectra.concern;
    body = `# ${concern}\n\n\`\`\`yaml\n${designYaml}\n\`\`\``;
  }

  return `---\n${yamlStr}\n---\n\n${body}\n`;
}
