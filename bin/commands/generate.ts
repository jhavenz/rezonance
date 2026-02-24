import type { CommandModule } from 'yargs';
import { spawn } from 'child_process';
import { join } from 'path';
import { loadConfig } from '../../src/config/index.js';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
} as const;

function logInfo(message: string): void {
  console.log(`${COLORS.dim}${message}${COLORS.reset}`);
}

function logSuccess(message: string): void {
  console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message: string): void {
  console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
}

function getKubbConfigPath(): string {
  // Resolve config from the resonance package (use .ts source directly - bun handles it)
  const configPath = join(__dirname, '..', 'kubb.config.ts');
  return configPath;
}

async function runGeneration(): Promise<void> {
  const config = await loadConfig();

  logInfo('Generating API client code...');

  const kubbConfig = getKubbConfigPath();

  // Pass kubb options via environment variables
  const kubbEnv = {
    ...process.env,
    FORCE_COLOR: '1',
    RESONANCE_KUBB_OPENAPI_URL: config.kubb?.openApiUrl || '',
    RESONANCE_KUBB_OUTPUT_PATH: config.kubb?.outputPath || '',
    RESONANCE_KUBB_CLIENT_PATH: config.kubb?.clientImportPath || '',
  };

  const proc = spawn('bunx', ['kubb', 'generate', '--config', kubbConfig], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: kubbEnv,
  });

  let stderr = '';

  if (proc.stdout) {
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });
  }

  if (proc.stderr) {
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
  }

  const exitCode = await new Promise<number | null>((resolve) => {
    proc.on('exit', (code) => resolve(code));
  });

  if (exitCode !== 0) {
    logError(`Generation failed:\n${stderr}`);
    process.exit(1);
  }

  // Note: Kubb's hooks.done automatically runs the fix-kubb-duplicates script
  logSuccess('API client code generated');
}

export const generateCommand: CommandModule = {
  command: 'generate',
  describe: 'Generate API client code from OpenAPI spec',
  handler: async () => {
    try {
      await runGeneration();
    } catch (err) {
      logError(`Fatal error: ${err}`);
      process.exit(1);
    }
  },
};
