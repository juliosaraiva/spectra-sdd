import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { resolveSpectraPath } from "../core/config.js";
import { contentHash, canonicalize } from "../core/hash.js";
import { loadTemplateById } from "./template-loader.js";
import { lockGeneration, isLocked, readLockEntry } from "./lock.js";
import { selectConstraints, loadConstitution } from "../core/constitution.js";

export interface GenerationResult {
  success: boolean;
  output?: string;
  generation_id?: string;
  input_hash: string;
  template_hash: string;
  output_hash?: string;
  skipped?: boolean;
  error?: string;
}

export interface GenerationOptions {
  templateId: string;
  specId: string;
  specVersion: string;
  target: string;
  force?: boolean;
}

/**
 * Generate output from a spec using a template.
 * Returns the rendered prompt (for human use) or generated output (when AI adapter is configured).
 *
 * Currently renders the prompt template — AI adapter integration is Phase 3.
 */
export async function generate(
  projectRoot: string,
  options: GenerationOptions
): Promise<GenerationResult> {
  const { templateId, specId, specVersion, target, force } = options;

  // Load spec
  const featureName = specId.replace(/^feat:/, "");
  const specPath = resolveSpectraPath(
    projectRoot,
    "features",
    `${featureName}.spec.yaml`
  );

  let specRaw: string;
  try {
    specRaw = await readFile(specPath, "utf8");
  } catch {
    return {
      success: false,
      input_hash: "",
      template_hash: "",
      error: `Spec file not found: ${specPath}`,
    };
  }

  const specParsed = parse(specRaw);
  const inputHash = contentHash(specParsed);

  // Load template
  const template = await loadTemplateById(projectRoot, templateId);
  if (!template) {
    return {
      success: false,
      input_hash: inputHash,
      template_hash: "",
      error: `Template not found: ${templateId}`,
    };
  }

  const templateHash = contentHash({ id: templateId, version: "1.0" });

  // Check lock — skip if already generated with same inputs
  if (!force) {
    const locked = await isLocked(
      projectRoot,
      specId,
      specVersion,
      target,
      inputHash,
      templateHash
    );
    if (locked) {
      const entry = await readLockEntry(projectRoot, specId, specVersion, target);
      return {
        success: true,
        generation_id: entry?.generation_id,
        input_hash: inputHash,
        template_hash: templateHash,
        output_hash: entry?.output_hash,
        skipped: true,
      };
    }
  }

  // Load constitutional context
  let constitutionalContext = "";
  try {
    const constitution = await loadConstitution(projectRoot);
    const domain = specParsed?.identity?.domain ?? [];
    const constraints = selectConstraints(constitution, domain);
    if (constraints.length > 0) {
      constitutionalContext = constraints
        .map(
          (c) =>
            `[${c.id}] ${c.enforcement}: ${c.title}\n  ${c.description}`
        )
        .join("\n\n");
    }
  } catch {
    // No constitution
  }

  // Render template
  const rendered = template({
    spec: specParsed,
    spec_canonical_yaml: canonicalize(specParsed),
    spec_yaml: specRaw,
    constitutional_context: constitutionalContext,
    spec_id: specId,
    spec_version: specVersion,
    target,
  });

  const outputHash = contentHash({ output: rendered });

  // Lock the generation
  const lockEntry = await lockGeneration(
    projectRoot,
    specId,
    specVersion,
    target,
    {
      template_id: templateId,
      template_version: "1.0",
      template_hash: templateHash,
      input_spec_hash: inputHash,
      model: "human",
      model_params: {},
      output_hash: outputHash,
    }
  );

  return {
    success: true,
    output: rendered,
    generation_id: lockEntry.generation_id,
    input_hash: inputHash,
    template_hash: templateHash,
    output_hash: outputHash,
  };
}
