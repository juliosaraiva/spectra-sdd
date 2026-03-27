import { readFile, access } from "node:fs/promises";
import { parse } from "yaml";
import { parseFeatureSpecMd, parseImplSpecMd } from "./frontmatter.js";

/**
 * Checks if a file is in Markdown+Frontmatter format (by extension).
 */
export function isMarkdownSpec(filePath: string): boolean {
  return filePath.endsWith(".spec.md") || filePath.endsWith(".impl.md");
}

/**
 * Checks if a file is a feature spec (either format).
 */
export function isFeatureSpec(fileName: string): boolean {
  return (
    fileName.endsWith(".spec.yaml") ||
    fileName.endsWith(".spec.yml") ||
    fileName.endsWith(".spec.md")
  );
}

/**
 * Checks if a file is an impl spec (either format).
 */
export function isImplSpec(fileName: string): boolean {
  return (
    fileName.endsWith(".impl.yaml") ||
    fileName.endsWith(".impl.yml") ||
    fileName.endsWith(".impl.md")
  );
}

/**
 * Reads and parses a spec file, auto-detecting format by extension.
 * Returns the same object shape regardless of whether the source is YAML or Markdown+Frontmatter.
 */
export async function readSpecFile(filePath: string): Promise<{
  raw: string;
  parsed: Record<string, unknown>;
}> {
  const raw = await readFile(filePath, "utf8");
  const parsed = parseSpecContent(raw, filePath);
  return { raw, parsed };
}

/**
 * Parses spec content based on file extension.
 * For Markdown feature specs: frontmatter + AC parsing from body.
 * For Markdown impl specs: frontmatter + body as design.
 * For YAML: standard yaml.parse().
 */
export function parseSpecContent(raw: string, filePath: string): Record<string, unknown> {
  if (filePath.endsWith(".spec.md")) {
    return parseFeatureSpecMd(raw);
  }
  if (filePath.endsWith(".impl.md")) {
    return parseImplSpecMd(raw);
  }
  // Default: YAML
  return parse(raw) as Record<string, unknown>;
}

/**
 * Resolves a spec file path, preferring .md over .yaml.
 * Tries .md first, falls back to .yaml/.yml.
 */
export async function resolveSpecFile(
  basePath: string,
  name: string,
  type: "spec" | "impl"
): Promise<string> {
  const mdExt = `.${type}.md`;
  const yamlExt = `.${type}.yaml`;
  const ymlExt = `.${type}.yml`;

  const mdPath = `${basePath}/${name}${mdExt}`;
  const yamlPath = `${basePath}/${name}${yamlExt}`;
  const ymlPath = `${basePath}/${name}${ymlExt}`;

  // Prefer .md if it exists
  try {
    await access(mdPath);
    return mdPath;
  } catch {
    // try yaml
  }

  try {
    await access(yamlPath);
    return yamlPath;
  } catch {
    // try yml
  }

  try {
    await access(ymlPath);
    return ymlPath;
  } catch {
    // return yaml as default (will fail with clear error when read)
    return yamlPath;
  }
}
