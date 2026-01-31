import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'yaml';
import type { Config } from './types.js';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'default.yaml');

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
  const fullPath = path.join(process.cwd(), promptPath);
  return fs.readFile(fullPath, 'utf-8');
}

/**
 * Get the analyzer prompt
 */
export async function getAnalyzerPrompt(): Promise<string> {
  const config = await loadConfig();
  return loadPrompt(config.prompts.analyzer);
}

// Test the config loader when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Testing config loader...\n');

  try {
    const config = await loadConfig();
    console.log('Config loaded successfully:');
    console.log(JSON.stringify(config, null, 2));

    console.log('\n--- Analyzer Prompt ---');
    const analyzerPrompt = await getAnalyzerPrompt();
    console.log(analyzerPrompt.slice(0, 200) + '...');

    console.log('\n✓ Config test passed!');
  } catch (error) {
    console.error('Config test failed:', error);
    process.exit(1);
  }
}
