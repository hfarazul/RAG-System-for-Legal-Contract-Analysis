import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'yaml';
import type { Config } from './types';

// Path to parent directory's config
const PROJECT_ROOT = path.join(process.cwd(), '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'default.yaml');

let cachedConfig: Config | null = null;

/**
 * Load configuration from YAML file
 */
export async function loadConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
  cachedConfig = parse(configContent) as Config;
  return cachedConfig;
}

/**
 * Load a prompt file
 */
export async function loadPrompt(promptPath: string): Promise<string> {
  const fullPath = path.join(PROJECT_ROOT, promptPath);
  return fs.readFile(fullPath, 'utf-8');
}

/**
 * Get the analyzer prompt
 */
export async function getAnalyzerPrompt(): Promise<string> {
  const config = await loadConfig();
  return loadPrompt(config.prompts.analyzer);
}
