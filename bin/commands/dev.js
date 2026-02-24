// bin/commands/dev.ts
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join as join2 } from "path";

// src/config/types.ts
var defaultConfig = {
  server: {},
  queue: false,
  customCommands: [],
  kubb: {}
};

// src/config/loader.ts
import { pathToFileURL } from "url";
import { join } from "path";
import { stat } from "fs/promises";
var CONFIG_FILE_NAMES = [
  "resonance.config.ts",
  "resonance.config.js",
  "resonance.config.mjs"
];
async function fileExists(path) {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}
async function findConfigFile(rootDir) {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = join(rootDir, fileName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  }
  return null;
}
async function loadConfigFile(configPath, context) {
  try {
    const fileUrl = pathToFileURL(configPath).href;
    const configModule = await import(fileUrl);
    const configExport = configModule.default || configModule;
    if (typeof configExport === "function") {
      const functionConfig = configExport;
      return await functionConfig(context);
    }
    return configExport;
  } catch (error) {
    throw new Error(`Failed to load config file ${configPath}: ${error}`);
  }
}
function mergeConfig(userConfig) {
  return {
    server: {
      ...defaultConfig.server,
      ...userConfig.server
    },
    queue: userConfig.queue ?? defaultConfig.queue,
    customCommands: userConfig.customCommands ?? defaultConfig.customCommands,
    kubb: {
      ...defaultConfig.kubb,
      ...userConfig.kubb
    }
  };
}
async function loadConfig(rootDir = process.cwd(), context = { mode: "development", command: "dev" }) {
  const configPath = await findConfigFile(rootDir);
  if (!configPath) {
    return defaultConfig;
  }
  try {
    const userConfig = await loadConfigFile(configPath, context);
    return mergeConfig(userConfig);
  } catch (error) {
    console.warn(`Warning: ${error}`);
    console.warn("Falling back to default configuration");
    return defaultConfig;
  }
}
function validateConfig(config) {
  const errors = [];
  if (config.server?.port && (config.server.port < 1 || config.server.port > 65535)) {
    errors.push("server.port must be between 1 and 65535");
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
    errors
  };
}
// bin/commands/dev.ts
var __dirname = "/Users/jhavens/Code/Me/ResonanceFramework/packages/resonance/bin/commands";
var COLORS = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  yellow: "\x1B[33m",
  green: "\x1B[32m",
  red: "\x1B[31m"
};
var processes = new Map;
var shuttingDown = false;
function loadEnvFile() {
  try {
    const envPath = join2(process.cwd(), ".env");
    const envFile = readFileSync(envPath, "utf8");
    for (const line of envFile.split(`
`)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").replace(/^["']|["']$/g, "");
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    logError(`Failed to load .env file: ${error}`);
  }
}
function printBanner() {
  console.log();
  console.log(`${COLORS.bold}${COLORS.cyan}  RESONANCE${COLORS.reset} ${COLORS.dim}v1.0.0${COLORS.reset}`);
  console.log();
}
function stripEmojis(text) {
  return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").replace(/[\u{2600}-\u{26FF}]/gu, "").replace(/[\u{2700}-\u{27BF}]/gu, "").replace(/[\u{FE00}-\u{FE0F}]/gu, "").replace(/[\u{1F000}-\u{1F02F}]/gu, "").replace(/\u26A1/g, "").replace(/\s{2,}/g, " ").trim();
}
function log(prefix, color, message) {
  const lines = message.split(`
`).filter((line) => line.trim());
  for (let line of lines) {
    if (prefix === "vite") {
      line = line.replace(/\[vite\]\s*/g, "");
    }
    line = stripEmojis(line);
    console.log(`${color}>${COLORS.reset} ${COLORS.dim}${prefix}${COLORS.reset} ${line}`);
  }
}
function logReady(service, url) {
  if (url) {
    console.log(`${COLORS.green}[ok]${COLORS.reset} ${COLORS.bold}${service}${COLORS.reset} ${COLORS.dim}ready at${COLORS.reset} ${COLORS.cyan}${url}${COLORS.reset}`);
  } else {
    console.log(`${COLORS.green}[ok]${COLORS.reset} ${COLORS.bold}${service}${COLORS.reset} ${COLORS.dim}ready${COLORS.reset}`);
  }
}
function logInfo(message) {
  console.log(`${COLORS.dim}${message}${COLORS.reset}`);
}
function logError(message) {
  console.log(`${COLORS.red}[error]${COLORS.reset} ${message}`);
}
function parseAppUrl(config) {
  const appUrl = process.env.APP_URL ?? "http://localhost:8880";
  try {
    const url = new URL(appUrl);
    return {
      host: config.server.host || url.hostname,
      port: (config.server.port || parseInt(url.port) || 8880).toString()
    };
  } catch {
    logError(`Invalid APP_URL: ${appUrl}, using config defaults`);
    return {
      host: config.server.host || "localhost",
      port: (config.server.port || 8880).toString()
    };
  }
}
async function spawnProcess(config) {
  const [command, ...args] = config.cmd;
  const proc = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
    cwd: config.cwd
  });
  processes.set(config.name, proc);
  if (proc.stdout) {
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (data) => {
      log(config.name, config.color, data.toString());
    });
  }
  if (proc.stderr) {
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (data) => {
      log(config.name, config.color, data.toString());
    });
  }
  return new Promise((resolve) => {
    proc.on("exit", (code) => {
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
async function shutdown(code = 0) {
  if (shuttingDown)
    return;
  shuttingDown = true;
  console.log();
  logInfo("Shutting down...");
  const killPromises = [];
  for (const [, proc] of processes) {
    killPromises.push(new Promise((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill("SIGKILL");
        resolve();
      }, 3000);
      proc.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      proc.kill("SIGTERM");
    }));
  }
  await Promise.all(killPromises);
  process.exit(code);
}
async function waitForServer(host, port, maxAttempts = 30) {
  const url = `http://${host}:${port}/up`;
  for (let i = 0;i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server failed to start after ${maxAttempts} seconds`);
}
function getKubbConfigPath() {
  const configPath = join2(__dirname, "..", "kubb.config.ts");
  return configPath;
}
async function runKubbGeneration(config) {
  logInfo("Generating API client...");
  const kubbConfig = getKubbConfigPath();
  const kubbEnv = {
    ...process.env,
    FORCE_COLOR: "1",
    RESONANCE_KUBB_OPENAPI_URL: config.kubb?.openApiUrl || "",
    RESONANCE_KUBB_OUTPUT_PATH: config.kubb?.outputPath || "",
    RESONANCE_KUBB_CLIENT_PATH: config.kubb?.clientImportPath || ""
  };
  const proc = spawn("bunx", ["kubb", "generate", "--config", kubbConfig], {
    stdio: ["ignore", "pipe", "pipe"],
    env: kubbEnv
  });
  let stderr = "";
  if (proc.stdout) {
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        log("kubb", COLORS.green, output);
      }
    });
  }
  if (proc.stderr) {
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
  }
  const exitCode = await new Promise((resolve) => {
    proc.on("exit", resolve);
  });
  if (exitCode !== 0) {
    logError(`Generation failed:
${stderr}`);
    process.exit(1);
  }
  logReady("API client");
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
async function runDev(options) {
  loadEnvFile();
  const configDir = options.config || process.cwd();
  const config = await loadConfig(configDir);
  const validation = validateConfig(config);
  if (!validation.valid) {
    logError("Configuration validation failed:");
    validation.errors.forEach((error) => logError(`  ${error}`));
    process.exit(1);
  }
  const enableQueue = options.queue ?? config.queue;
  const { host, port } = parseAppUrl(config);
  printBanner();
  logInfo(`Starting development environment...`);
  logInfo(`Server: ${host}:${port}`);
  if (enableQueue) {
    logInfo("Queue worker: enabled");
  }
  console.log();
  const serverConfig = {
    name: "server",
    cmd: ["php", "artisan", "serve", `--host=${host}`, `--port=${port}`],
    color: COLORS.blue
  };
  spawnProcess(serverConfig);
  logInfo("Waiting for Laravel server...");
  await waitForServer(host, port);
  logReady("Laravel", `http://${host}:${port}`);
  console.log();
  await runKubbGeneration(config);
  console.log();
  const configs = [
    {
      name: "pail",
      cmd: ["php", "artisan", "pail", "--timeout=0"],
      color: COLORS.magenta
    },
    {
      name: "vite",
      cmd: ["npx", "vite"],
      color: COLORS.cyan
    }
  ];
  if (enableQueue) {
    configs.push({
      name: "queue",
      cmd: ["php", "artisan", "queue:listen", "--tries=1"],
      color: COLORS.yellow
    });
  }
  config.customCommands.forEach((customCmd, index) => {
    configs.push({
      name: customCmd.name,
      cmd: customCmd.cmd,
      color: customCmd.color || COLORS.cyan,
      cwd: customCmd.cwd
    });
  });
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  await Promise.all(configs.map(spawnProcess));
}
var devCommand = {
  command: "dev",
  describe: "Start development servers",
  builder: (yargs) => {
    return yargs.option("queue", {
      type: "boolean",
      description: "Enable Laravel queue worker (overrides config)",
      default: false
    }).option("config", {
      type: "string",
      description: "Path to config directory (defaults to current directory)",
      alias: "c"
    });
  },
  handler: async (argv) => {
    try {
      await runDev(argv);
    } catch (err) {
      logError(`Fatal error: ${err}`);
      process.exit(1);
    }
  }
};
export {
  devCommand
};
