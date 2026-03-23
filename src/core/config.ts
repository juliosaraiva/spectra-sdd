import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { ConfigSchema, type Config } from "./spec-types.js";

export const SPECTRA_DIR = ".spectra";

export const DEFAULT_CONFIG: Config = {
  spectra: {
    version: "1.0",
    project_id: "my-project",
  },
  ai: {
    adapter: "none",
    primary_agent: "none",
  },
  spec: {
    id_prefix: "feat",
    default_status: "draft",
  },
  git: {
    gate_branch_protection: false,
    trace_commit_hook: false,
  },
  hooks: {},
  ai_tools: {
    adapter: "none",
    enforcement: "warn",
    skip_paths: [],
  },
};

export function spectraDir(projectRoot: string): string {
  return join(projectRoot, SPECTRA_DIR);
}

export function configPath(projectRoot: string): string {
  return join(spectraDir(projectRoot), "config.yaml");
}

export async function loadConfig(projectRoot: string): Promise<Config> {
  try {
    const raw = await readFile(configPath(projectRoot), "utf8");
    const parsed = parse(raw);
    return ConfigSchema.parse(parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function resolveSpectraPath(
  projectRoot: string,
  ...segments: string[]
): string {
  return join(spectraDir(projectRoot), ...segments);
}
