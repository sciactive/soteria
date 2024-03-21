import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { program } from 'commander';
import updateNotifier from 'update-notifier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json')).toString()
);

type Conf = {
  server: string;
  updateCheck: boolean;
};

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Print the current version');

program
  .option('-s, --server <host>', 'The address of the WebDAV server.')
  .option('--no-update-check', "Don't check for updates.");

program.addHelpText(
  'after',
  `
Environment Variables:
  SERVER          Same as --server.
  UPDATE_CHECK    Same as --no-update-check when set to "false", "off" or "0".

Options given on the command line take precedence over options from an environment variable.`
);

program.addHelpText(
  'afterAll',
  `
Soteria repo: https://github.com/sciactive/soteria
Copyright (C) 2024 SciActive, Inc
https://sciactive.com/`
);

try {
  // Parse args.
  program.parse();
  const options = program.opts();
  let { server, updateCheck } = {
    server: process.env.SERVER,
    updateCheck: !['false', 'off', '0'].includes(
      (process.env.UPDATE_CHECK || '').toLowerCase()
    ),
    ...options,
  } as Conf;

  if (updateCheck) {
    updateNotifier({ pkg }).notify({ defer: false });
  }

  if (server == null) {
    throw new Error('WebDAV server address is required.');
  }
} catch (e: any) {
  console.error('Error:', e.message);
  process.exit(1);
}
