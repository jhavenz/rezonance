import type { CommandModule } from 'yargs';
import { spawn, type ChildProcess } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, validateConfig, type ResonanceConfig } from '../../src/config/index.js';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
} as const;

interface DevOptions {
  queue?: boolean;
  config?: string;
}

interface ProcessConfig {
  name: string;
  cmd: string[];
  color: string;
  cwd?: string;
}

const processes: Map<string, ChildProcess> = new Map();
let shuttingDown = false;

function loadEnvFile(): void {
  try {
    const envPath = join(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf8');
    
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    logError(`Failed to load .env file: ${error}`);
  }
}

function printBanner(): void {
  console.log();
  console.log(`${COLORS.bold}${COLORS.cyan}  RESONANCE${COLORS.reset} ${COLORS.dim}v1.0.0${COLORS.reset}`);
  console.log();
}

function stripEmojis(text: string): string {
  // Remove common Unicode emojis and symbols
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Misc symbols and pictographs
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // Variation selectors
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')  // Mahjong tiles
    .replace(/\u26A1/g, '')                   // Lightning bolt
    .replace(/\s{2,}/g, ' ')                  // Collapse multiple spaces
    .trim();
}

function log(prefix: string, color: string, message: string): void {
  const lines = message.split('\n').filter((line) => line.trim());
  for (let line of lines) {
    // Strip redundant [vite] prefix from Vite's own output
    if (prefix === 'vite') {
      line = line.replace(/\[vite\]\s*/g, '');
    }
    // Strip emojis from external tool output
    line = stripEmojis(line);
    console.log(`${color}>${COLORS.reset} ${COLORS.dim}${prefix}${COLORS.reset} ${line}`);
  }
}

function logReady(service: string, url?: string): void {
  if (url) {
    console.log(`${COLORS.green}[ok]${COLORS.reset} ${COLORS.bold}${service}${COLORS.reset} ${COLORS.dim}ready at${COLORS.reset} ${COLORS.cyan}${url}${COLORS.reset}`);
  } else {
    console.log(`${COLORS.green}[ok]${COLORS.reset} ${COLORS.bold}${service}${COLORS.reset} ${COLORS.dim}ready${COLORS.reset}`);
  }
}

function logInfo(message: string): void {
  console.log(`${COLORS.dim}${message}${COLORS.reset}`);
}

function logError(message: string): void {
  console.log(`${COLORS.red}[error]${COLORS.reset} ${message}`);
}

function parseAppUrl(config: Required<ResonanceConfig>): { host: string; port: string } {
  const appUrl = process.env.APP_URL ?? 'http://localhost:8880';

  try {
    const url = new URL(appUrl);
    return {
      host: config.server.host || url.hostname,
      port: (config.server.port || parseInt(url.port) || 8880).toString(),
    };
  } catch {
    logError(`Invalid APP_URL: ${appUrl}, using config defaults`);
    return { 
      host: config.server.host || 'localhost', 
      port: (config.server.port || 8880).toString() 
    };
  }
}

async function spawnProcess(config: ProcessConfig): Promise<void> {
  const [command, ...args] = config.cmd;
  const proc = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    cwd: config.cwd,
  });

  processes.set(config.name, proc);

  if (proc.stdout) {
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (data) => {
      log(config.name, config.color, data.toString());
    });
  }

  if (proc.stderr) {
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (data) => {
      log(config.name, config.color, data.toString());
    });
  }

  return new Promise<void>((resolve) => {
    proc.on('exit', (code) => {
      processes.delete(config.name);

      if (!shuttingDown && code !== 0 && code !== null) {
        logError(`${config.name} exited with code ${code}`);
        shutdown(1).then(resolve);
      } else {
        resolve();
      }
    });
  });
}

async function shutdown(code: number = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log();
  logInfo('Shutting down...');

  const killPromises: Promise<void>[] = [];

  for (const [, proc] of processes) {
    killPromises.push(
      new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve();
        }, 3000);

        proc.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        proc.kill('SIGTERM');
      })
    );
  }

  await Promise.all(killPromises);
  process.exit(code);
}

async function waitForServer(
  host: string,
  port: string,
  maxAttempts: number = 30
): Promise<void> {
  const url = `http://${host}:${port}/up`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Server failed to start after ${maxAttempts} seconds`);
}


function getKubbConfigPath(): string {
  // Resolve config from the resonance package (use .ts source directly - bun handles it)
  const configPath = join(__dirname, '..', 'kubb.config.ts');
  return configPath;
}

async function runKubbGeneration(config: Required<ResonanceConfig>): Promise<void> {
  logInfo('Generating API client...');

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
      const output = data.toString().trim();
      if (output) {
        log('kubb', COLORS.green, output);
      }
    });
  }

  if (proc.stderr) {
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
  }

  const exitCode = await new Promise<number | null>((resolve) => {
    proc.on('exit', resolve);
  });

  if (exitCode !== 0) {
    logError(`Generation failed:\n${stderr}`);
    process.exit(1);
  }

  // Note: Kubb's hooks.done automatically runs the fix-kubb-duplicates script
  logReady('API client');

  // Add delay to ensure Vite doesn't see duplicate exports
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function runDev(options: DevOptions): Promise<void> {
  // Load environment variables from .env file
  loadEnvFile();
  
  // Load and validate configuration
  const configDir = options.config || process.cwd();
  const config = await loadConfig(configDir);
  const validation = validateConfig(config);
  
  if (!validation.valid) {
    logError('Configuration validation failed:');
    validation.errors.forEach(error => logError(`  ${error}`));
    process.exit(1);
  }
  
  // CLI options override config
  const enableQueue = options.queue ?? config.queue;

  const { host, port } = parseAppUrl(config);

  printBanner();
  logInfo(`Starting development environment...`);
  logInfo(`Server: ${host}:${port}`);
  if (enableQueue) {
    logInfo('Queue worker: enabled');
  }
  console.log();

  // Start Laravel server first
  const serverConfig: ProcessConfig = {
    name: 'server',
    cmd: ['php', 'artisan', 'serve', `--host=${host}`, `--port=${port}`],
    color: COLORS.blue,
  };

  spawnProcess(serverConfig);

  // Wait for server to be ready
  logInfo('Waiting for Laravel server...');
  await waitForServer(host, port);
  logReady('Laravel', `http://${host}:${port}`);
  console.log();

  // Generate API client code after server is up
  await runKubbGeneration(config);
  console.log();

  // Start remaining services
  const configs: ProcessConfig[] = [
    {
      name: 'pail',
      cmd: ['php', 'artisan', 'pail', '--timeout=0'],
      color: COLORS.magenta,
    },
    {
      name: 'vite',
      cmd: ['npx', 'vite'],
      color: COLORS.cyan,
    },
  ];

  if (enableQueue) {
    configs.push({
      name: 'queue',
      cmd: ['php', 'artisan', 'queue:listen', '--tries=1'],
      color: COLORS.yellow,
    });
  }

  // Add custom commands from config
  config.customCommands.forEach((customCmd, index) => {
    configs.push({
      name: customCmd.name,
      cmd: customCmd.cmd,
      color: customCmd.color || COLORS.cyan,
      cwd: customCmd.cwd,
    });
  });

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  await Promise.all(configs.map(spawnProcess));
}

export const devCommand: CommandModule<{}, DevOptions> = {
  command: 'dev',
  describe: 'Start development servers',
  builder: (yargs) => {
    return yargs
      .option('queue', {
        type: 'boolean',
        description: 'Enable Laravel queue worker (overrides config)',
        default: false,
      })
      .option('config', {
        type: 'string',
        description: 'Path to config directory (defaults to current directory)',
        alias: 'c',
      });
  },
  handler: async (argv) => {
    try {
      await runDev(argv);
    } catch (err) {
      logError(`Fatal error: ${err}`);
      process.exit(1);
    }
  },
};
