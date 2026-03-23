import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import Handlebars from "handlebars";
import { stringify } from "yaml";
import { resolveSpectraPath } from "../core/config.js";
import { canonicalize } from "../core/hash.js";

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Register SPECTRA-specific Handlebars helpers.
 */
export function registerHelpers(): void {
  Handlebars.registerHelper("canonical_yaml", (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      return canonicalize(obj as Record<string, unknown>);
    }
    return String(obj);
  });

  Handlebars.registerHelper("to_yaml", (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      return stringify(obj, { lineWidth: 120 });
    }
    return String(obj);
  });

  Handlebars.registerHelper("json", (obj: unknown) => {
    return JSON.stringify(obj, null, 2);
  });

  Handlebars.registerHelper("ac_to_testcase", (ac: { id: string }) => {
    // Transform AC-001 to TC-001
    return ac.id.replace("AC-", "TC-");
  });
}

/**
 * Load a template file and compile it.
 */
export async function loadTemplate(templatePath: string): Promise<HandlebarsTemplateDelegate> {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath)!;
  }

  const raw = await readFile(templatePath, "utf8");
  const compiled = Handlebars.compile(raw, { noEscape: true });
  templateCache.set(templatePath, compiled);
  return compiled;
}

/**
 * Load a template by ID from the project's templates directory.
 * Falls back to built-in templates.
 */
export async function loadTemplateById(
  projectRoot: string,
  templateId: string
): Promise<HandlebarsTemplateDelegate | null> {
  // Check project templates first
  const projectTemplatePath = resolveSpectraPath(projectRoot, "templates", `${templateId}.tmpl`);

  try {
    return await loadTemplate(projectTemplatePath);
  } catch {
    // Not found in project — try built-in
  }

  // Built-in templates bundled with the package
  const builtinPath = join(
    new URL(".", import.meta.url).pathname,
    "..",
    "templates",
    `${templateId}.tmpl`
  );

  try {
    return await loadTemplate(builtinPath);
  } catch {
    return null;
  }
}

/**
 * List available templates in the project.
 */
export async function listTemplates(projectRoot: string): Promise<string[]> {
  const templatesDir = resolveSpectraPath(projectRoot, "templates");
  try {
    const files = await readdir(templatesDir);
    return files.filter((f) => f.endsWith(".tmpl")).map((f) => basename(f, ".tmpl"));
  } catch {
    return [];
  }
}

// Register helpers on module load
registerHelpers();
