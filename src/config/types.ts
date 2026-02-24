/**
 * Kubb generation configuration
 */
export interface KubbConfig {
  /** URL to OpenAPI spec endpoint (default: APP_URL + '/docs/api') */
  openApiUrl?: string;
  /** Output directory for generated code (default: './resources/js/.resonance') */
  outputPath?: string;
  /** Custom client import path (default: '@jhavenz/resonance/client/kubb-client') */
  clientImportPath?: string;
}

export interface ResonanceConfig {
  /**
   * Server configuration
   */
  server?: {
    /** Server host override (defaults to APP_URL hostname or localhost) */
    host?: string;
    /** Server port override (defaults to APP_URL port or 8880) */
    port?: number;
  };

  /**
   * Enable/disable queue worker during development
   * @default false
   */
  queue?: boolean;

  /**
   * Custom commands to run alongside development servers
   * Each command will be spawned with its own process and color
   */
  customCommands?: Array<{
    name: string;
    cmd: string[];
    color?: string;
    /** Working directory for the command */
    cwd?: string;
  }>;

  /**
   * Kubb code generation configuration
   */
  kubb?: KubbConfig;
}

/**
 * Type for the configuration function that users can export
 * Allows for dynamic configuration based on environment
 */
export type ResonanceConfigFunction = (env: {
  mode: string;
  command: string;
}) => ResonanceConfig | Promise<ResonanceConfig>;

/**
 * The configuration export can be either an object or a function
 */
export type ResonanceConfigExport = ResonanceConfig | ResonanceConfigFunction;

/**
 * Default configuration with sensible defaults
 */
export const defaultConfig: Required<ResonanceConfig> = {
  server: {},
  queue: false,
  customCommands: [],
  kubb: {},
};