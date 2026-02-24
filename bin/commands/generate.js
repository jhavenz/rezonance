// bin/commands/generate.ts
import { spawn } from "child_process";
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
// bin/commands/generate.ts
var __dirname = "/Users/jhavens/Code/Me/ResonanceFramework/packages/resonance/bin/commands";
var COLORS = {
  reset: "\x1B[0m",
  dim: "\x1B[2m",
  green: "\x1B[32m",
  red: "\x1B[31m"
};
function logInfo(message) {
  console.log(`${COLORS.dim}${message}${COLORS.reset}`);
}
function logSuccess(message) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
}
function logError(message) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
}
function getKubbConfigPath() {
  const configPath = join2(__dirname, "..", "kubb.config.ts");
  return configPath;
}
async function runGeneration() {
  const config = await loadConfig();
  logInfo("Generating API client code...");
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
      process.stdout.write(data.toString());
    });
  }
  if (proc.stderr) {
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
  }
  const exitCode = await new Promise((resolve) => {
    proc.on("exit", (code) => resolve(code));
  });
  if (exitCode !== 0) {
    logError(`Generation failed:
${stderr}`);
    process.exit(1);
  }
  logSuccess("API client code generated");
}
var generateCommand = {
  command: "generate",
  describe: "Generate API client code from OpenAPI spec",
  handler: async () => {
    try {
      await runGeneration();
    } catch (err) {
      logError(`Fatal error: ${err}`);
      process.exit(1);
    }
  }
};
export {
  generateCommand
};
