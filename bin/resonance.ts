#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { devCommand } from './commands/dev.js';
import { generateCommand } from './commands/generate.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('resonance')
  .usage('$0 <command> [options]')
  .command(devCommand)
  .command(generateCommand)
  .demandCommand(1, 'You must provide a command')
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .strict();

cli.parse();
