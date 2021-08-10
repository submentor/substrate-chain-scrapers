import { PrismaService } from '../app/prisma/prisma.service';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { waitFor } from '../utils';
import { Command, Option } from 'commander';

import HydraDX from './scripts/HydraDX';
import { chainTypes } from '../chain-types';

// npx ts-node -r tsconfig-paths/register src/console-apps/console-scripts.ts -s cosi
//node ./dist/console-apps/console-scripts.js -s cosi

const program = new Command();
program
  .addOption(new Option('-s, --script <scriptName>', 'select script to run'))
  .parse();

const options = program.opts();

const wsProvider = new WsProvider(process.env.CHAIN);
const providerOptions = {
  provider: wsProvider,
  types: chainTypes,
};

let api;

const prisma = new PrismaService();

const init = async () => {
  api = await ApiPromise.create(providerOptions);
  await api.isReady;
};

const main = async () => {
  await HydraDX();

  let now = new Date();
  const script = options.script;

  /*
  await init();
  console.log(`Task ${script}, started at ${now.toLocaleTimeString()}`);
  */

  now = new Date();
  console.log(`Task ${script}, finished at ${now.toLocaleTimeString()}`);
};

main()
  .then((result) => {
    console.log('All Done!');
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  })
  .catch((e) => console.log(`Error`));
