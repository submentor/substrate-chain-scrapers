import { PrismaService } from '../app/prisma/prisma.service';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { Direction } from '../app/polkadot/grabbers';
// import payoutEraGrabber from '../app/polkadot/grabbers/payouts-by-era';
// import payoutGrabber from '../app/polkadot/grabbers/payouts-by-block';
// import eraGrabber from '../app/polkadot/grabbers/era';
import blockGrabber from '../app/polkadot/grabbers/block';
import { waitFor } from '../utils';
import { Command, Option } from 'commander';
import { chainTypes } from '../chain-types';

// npx ts-node -r tsconfig-paths/register src/console-apps/grabbers.ts -g block -gd range-from-to -n 1 100
// npx ts-node -r tsconfig-paths/register src/console-apps/grabbers.ts -g era -gd range-from-to -n 20 19
//node ./dist/scripts/my-console.js -g block -gd range-from-to -n 280048 250000

const program = new Command();
program
  .addOption(
    new Option(
      '-gd, --grabb-direction <direction>',
      'grabber direction type'
    ).choices([
      'exact',
      'array',
      'from-highest-to-new',
      'from-lowest-to-zero',
      'gaps',
      'range-from-to',
      'from-actual-to-highest',
    ])
  )
  .option('-n, --numbers <numbers...>', 'numbers for exact or range direction')
  .option('-g, --grabber <grabber>', 'grabber to run')
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
  await init();

  const directionOpt = options.grabbDirection;
  let direction: Direction;
  const grabber = options.grabber;

  let now = new Date();
  console.log(
    `Task to proceed: ${grabber}, started at ${now.toLocaleTimeString()}`
  );

  let exactNumber;
  let higherNumber;
  let lowerNumber;

  switch (directionOpt) {
    case 'gaps':
      direction = 'GAPS';
      break;
    case 'from-highest-to-new':
      direction = 'FROM_HIGHEST_SAVED_UP_TO_NEW';
      break;
    case 'from-lowest-to-zero':
      direction = 'FROM_LOWEST_SAVED_TO_ZERO';
      break;
    case 'from-actual-to-highest':
      direction = 'FROM_ACTUAL_TO_HIGHES_SAVED';
      break;
    case 'range-from-to':
      direction = 'RANGE_HIGHER_TO_LOWER';
      higherNumber = parseInt(options.numbers[0]); // TODO - error handling, numbers must be set
      lowerNumber = parseInt(options.numbers[1]);
      break;
    case 'exact':
      direction = 'EXACT';
      exactNumber = parseInt(options.numbers[0]);
      break;
    case 'array':
      direction = 'ARRAY';
    default:
      console.log('You provided unknown direction');
      break;
  }

  switch (grabber) {
    /*
    case 'payout':
      if (direction === 'EXACT') {
        await payoutGrabber(api, prisma, direction, {
          type: 'EXACT',
          exactNumber,
        });
      } else if (direction === 'RANGE_HIGHER_TO_LOWER') {
        await payoutGrabber(api, prisma, direction, {
          type: 'RANGE',
          higherRangeNumber: higherNumber,
          lowerRangeNumber: lowerNumber,
        });
      } else if (direction === 'ARRAY') {
        await payoutGrabber(api, prisma, direction),
          {
            type: 'ARRAY',
            array: options.numbers,
          };
      } else {
        await payoutGrabber(api, prisma, direction);
      }
      break;
    case 'era':
      if (direction === 'EXACT') {
        await eraGrabber(api, prisma, direction, {
          type: 'EXACT',
          exactNumber,
        });
      } else if (direction === 'RANGE_HIGHER_TO_LOWER') {
        await eraGrabber(api, prisma, direction, {
          type: 'RANGE',
          higherRangeNumber: higherNumber,
          lowerRangeNumber: lowerNumber,
        });
      } else {
        await eraGrabber(api, prisma, direction);
      }
      break;
    */
    case 'block':
      if (direction === 'EXACT') {
        await blockGrabber(api, prisma, direction, {
          type: 'EXACT',
          exactNumber,
        });
      } else if (direction === 'RANGE_HIGHER_TO_LOWER') {
        await blockGrabber(api, prisma, direction, {
          type: 'RANGE',
          higherRangeNumber: higherNumber,
          lowerRangeNumber: lowerNumber,
        });
      } else if (direction === 'ARRAY') {
        await blockGrabber(api, prisma, direction),
          {
            type: 'ARRAY',
            array: options.numbers,
          };
      } else {
        await blockGrabber(api, prisma, direction);
      }
      break;
    default:
      console.log('Nothing to do');
      break;
  }

  now = new Date();
  console.log(`Task ${grabber}, finished at ${now.toLocaleTimeString()}`);
};

main()
  .then((result) => {
    console.log('Done');
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  })
  .catch((e) => console.log(e.message));
