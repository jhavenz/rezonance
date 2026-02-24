import { createKubbConfig } from '../src/js/config/kubbConfigFactory';

export default createKubbConfig({
  openApiUrl: process.env.RESONANCE_KUBB_OPENAPI_URL || undefined,
  outputPath: process.env.RESONANCE_KUBB_OUTPUT_PATH || undefined,
  clientImportPath: process.env.RESONANCE_KUBB_CLIENT_PATH || undefined,
});
