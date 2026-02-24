import { pathToFileURL } from 'url';
import { join } from 'path';
import { stat } from 'fs/promises';
import type { ResonanceConfig, ResonanceConfigExport, ResonanceConfigFunction } from './types.js';
import { defaultConfig } from './types.js';

/**
 * Possible config file names (in order of preference)
 */
const CONFIG_FILE_NAMES = [
  'resonance.config.ts',
  'resonance.config.js',
  'resonance.config.mjs',
] as const;

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Find the configuration file in the project root
 */
async function findConfigFile(rootDir: string): Promise<string | null> {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = join(rootDir, fileName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Load and parse the configuration file
 */
async function loadConfigFile(configPath: string, context: { mode: string; command: string }): Promise<ResonanceConfig> {
  try {
    // Use dynamic import to load the config file
    // Convert to file URL to handle Windows paths properly
    const fileUrl = pathToFileURL(configPath).href;
    const configModule = await import(fileUrl);
    
    // Get the default export
    const configExport: ResonanceConfigExport = configModule.default || configModule;
    
    // Handle function-based config
    if (typeof configExport === 'function') {
      const functionConfig = configExport as ResonanceConfigFunction;
      return await functionConfig(context);
    }
    
    // Handle object-based config
    return configExport as ResonanceConfig;
  } catch (error) {
    throw new Error(`Failed to load config file ${configPath}: ${error}`);
  }
}

/**
 * Merge user configuration with defaults
 */
function mergeConfig(userConfig: ResonanceConfig): Required<ResonanceConfig> {
  return {
    server: {
      ...defaultConfig.server,
      ...userConfig.server,
    },
    queue: userConfig.queue ?? defaultConfig.queue,
    customCommands: userConfig.customCommands ?? defaultConfig.customCommands,
    kubb: {
      ...defaultConfig.kubb,
      ...userConfig.kubb,
    },
  };
}

/**
 * Load the Resonance configuration from the project root
 * 
 * @param rootDir - The project root directory (defaults to process.cwd())
 * @param context - Context information for function-based configs
 * @returns Merged configuration with defaults
 */
export async function loadConfig(
  rootDir: string = process.cwd(),
  context: { mode: string; command: string } = { mode: 'development', command: 'dev' }
): Promise<Required<ResonanceConfig>> {
  const configPath = await findConfigFile(rootDir);
  
  if (!configPath) {
    // No config file found, return defaults
    return defaultConfig;
  }
  
  try {
    const userConfig = await loadConfigFile(configPath, context);
    return mergeConfig(userConfig);
  } catch (error) {
    console.warn(`Warning: ${error}`);
    console.warn('Falling back to default configuration');
    return defaultConfig;
  }
}

/**
 * Validate configuration and provide helpful error messages
 */
export function validateConfig(config: ResonanceConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.server?.port && (config.server.port < 1 || config.server.port > 65535)) {
    errors.push('server.port must be between 1 and 65535');
  }

  if (config.customCommands) {
    config.customCommands.forEach((command, index) => {
      if (!command.name || !command.name.trim()) {
        errors.push(`customCommands[${index}].name is required`);
      }
      if (!command.cmd || !Array.isArray(command.cmd) || command.cmd.length === 0) {
        errors.push(`customCommands[${index}].cmd must be a non-empty array`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}