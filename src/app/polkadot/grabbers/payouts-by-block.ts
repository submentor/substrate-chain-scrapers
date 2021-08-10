import { ApiPromise } from '@polkadot/api';
import {
  BlockNumber,
  Hash,
  Moment,
  EraPoints,
  EraRewardPoints,
  EraIndex,
} from '@polkadot/types/interfaces';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import moment from 'moment';
import { Direction } from './index';
import { convertBalance, filterOutEvents } from '../polkadot.utils';
import { Prisma } from '@prisma/client';
import { access } from 'fs';

const logger = new Logger('payoutByBlockGrabber');

interface blockGrabberOptions {
  type: 'EXACT' | 'RANGE' | 'ARRAY';
  exactNumber?: number;
  higherRangeNumber?: number;
  lowerRangeNumber?: number;
  array?: Array<number>;
}

const payoutsGrabber = async (
  api: ApiPromise,
  prisma: PrismaService,
  direction: Direction,
  options?: blockGrabberOptions
) => {
  await api.isReady;

  const grabPayouts = async (blockNumber: number) => {
    try {
      // payouts is mady by extrinsics call which then emit payout event

      // first delete previous Payouts to make fresh grabbed data
      await prisma.eraPayout.deleteMany({
        where: {
          blockNumber: blockNumber,
        },
      });

      // find relevant extrinsics between block range
      const exs = await prisma.extrinsic.findMany({
        where: {
          blockNumber,
          OR: [
            { section: 'staking', method: 'payoutStakers' },
            { section: 'utility', method: 'batch' },
          ],
        },
      });

      for (let ex of exs) {
        let batchArgs = [];

        // if Extrinsics is utility.batch we have to parse args for
        // every payoutStakers made in this bathc tx
        if (ex.section === 'utility' && ex.method === 'batch') {
          const argsArr = ex.args;
          argsArr[0]
            .filter(
              (arg) =>
                arg.section === 'staking' && arg.method === 'payoutStakers'
            )
            .forEach((exItem) => {
              const foundIdx = batchArgs.findIndex((itemArgs) => {
                return exItem.args[0] === itemArgs.validator;
              });
              if (foundIdx < 0) {
                batchArgs.push({
                  validator: exItem.args[0],
                  eras: [exItem.args[1]],
                });
              } else {
                // we have to check if one validator did not make payut for more eras
                const validator = batchArgs[foundIdx];
                if (!validator.eras.includes(exItem.args[1])) {
                  batchArgs[foundIdx].eras.push(exItem.args[1]);
                }
              }
            });
        } else {
          batchArgs = [
            {
              validator: ex.args[0],
              eras: [ex.args[1]],
            },
          ];
        }

        // so no we have array of validators and for each validator list of eras
        //console.log(batchArgs);
        // for final solution we should go through each validator and for given era
        // find all nominators in the table ValidatorNominator. Then match payouts
        // this solution need to more test so for now, let do some workarround (maybe it would became the final solution)
        // just ensure how much ears do we have payouts for. If only for one, we could match payout with era
        // and leave validator unknown

        const extForEras = batchArgs.reduce((acc, current) => {
          current.eras.forEach((e) => {
            if (acc.indexOf(e) < 0) {
              acc.push(e);
            }
          });
          return acc;
        }, []);

        const events = await prisma.event.findMany({
          where: {
            blockNumber: ex.blockNumber,
            applyExtrinsic: ex.index,
            section: 'staking',
            method: 'Reward',
          },
        });

        let paidForEraIndex = parseInt(extForEras[0]);
        if (extForEras.length > 1) {
          // find if there are different eras
          paidForEraIndex = 0;
        }

        if (events.length > 0) {
          logger.log(
            `Grabber: Payouts for block number ${ex.blockNumber}, extrinsics ${ex.index}, paid for era ${paidForEraIndex} has ${events.length} payouts events to grab.`
          );
        } else {
          logger.warn(
            `There are no events for payoutStakers extrinsic ${ex.index} block number ${ex.blockNumber}`
          );
        }

        let paidByAddres = batchArgs[0].validator;
        if (batchArgs.length > 1) {
          paidByAddres = `Batch payout from ${batchArgs.length} validators`;
        }

        const paidBy = await prisma.account.findUnique({
          where: {
            accountId: paidByAddres,
          },
        });

        let paidForEra = await prisma.era.findUnique({
          where: {
            index: paidForEraIndex,
          },
        });

        if (!paidForEra) {
          throw new Error(
            `Era ${paidForEraIndex} for which is payouts made, cannot be found`
          );
        }

        let session = await prisma.session.findFirst({
          where: {
            startBlockNumber: {
              lte: blockNumber,
            },
          },
          orderBy: {
            startBlockNumber: 'desc',
          },
        });

        if (!session) {
          throw new Error('Cannot find Session for block');
        }

        let payoutInEra = await prisma.era.findFirst({
          where: {
            eraStartSessionIndex: {
              lte: session.index,
            },
          },
          orderBy: {
            eraStartSessionIndex: 'desc',
          },
        });

        if (!payoutInEra) {
          throw new Error(`Cannot find era for session ${session.index}`);
        }

        let y = 0;
        for (let event of events) {
          const payoutRecord: Prisma.EraPayoutCreateInput = {
            madeInEra: {
              connect: {
                index: payoutInEra.index,
              },
            },
            account: {
              connect: {
                accountId: event.data[0],
              },
            },
            accountAddress: event.data[0],
            event: {
              connect: {
                id: event.id,
              },
            },
            extrinsic: {
              connect: {
                id: ex.id,
              },
            },
            block: {
              connect: {
                number: event.blockNumber,
              },
            },
            blockDate: event.blockDate,
            payout: convertBalance(event.data[1]),
            paidByAccount: paidByAddres,
            ...(paidBy && {
              paidBy: {
                connect: {
                  id: paidBy.id,
                },
              },
            }),
            paidForEra: {
              connect: {
                index: paidForEraIndex,
              },
            },
          };
          await prisma.eraPayout.create({
            data: payoutRecord,
          });
          //logger.log(`Event ${y + 1} from ${events.length} proccessed.`);
          y++;
        }
        logger.log(`Grabber: Payouts events successfuly grabbed`);
      }
    } catch (e) {
      logger.error(e.message);
      throw Error(e);
    }
  };

  const NO_OF_TESTING_RECORDS = 10000000;
  let y = 0;
  let existedBlock;

  const grabThisBlock = async (blockNumber) => {
    logger.debug(`Payouts for Block number: ${blockNumber}`);

    await grabPayouts(blockNumber);
  };

  // GrabExact Block by number
  if (direction === 'EXACT') {
    const exactNumber =
      options && options.type === 'EXACT' && options.exactNumber;
    if (!exactNumber) {
      console.log(`You have to provide exact block number`);
      return;
    }
    await grabThisBlock(exactNumber);
  }

  if (direction === 'ARRAY') {
    const array = options && options.type === 'ARRAY' && options.array;
    if (!array) {
      console.log(`You have to provide blocks array`);
      return;
    }
    for (let number of array) {
      await grabThisBlock(number);
    }
  }

  if (direction === 'RANGE_HIGHER_TO_LOWER') {
    const higherNumber =
      options && options.type === 'RANGE' && options.higherRangeNumber;
    const lowerNumber =
      options && options.type === 'RANGE' && options.lowerRangeNumber;

    if (!higherNumber && !lowerNumber) {
      console.warn(`Range of the blocks to grab must be set`);
      return;
    }

    for (let i = higherNumber; i >= lowerNumber; i--) {
      y++;

      await grabThisBlock(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  // get first and last saved block from database, table Extrinsic
  const lowestSavedBlock = await prisma.eraPayout.findFirst({
    orderBy: [{ blockNumber: 'asc' }],
  });
  const lowestSavedBlockNumber = lowestSavedBlock
    ? lowestSavedBlock.blockNumber
    : 0;

  const highestSavedBlock = await prisma.eraPayout.findFirst({
    orderBy: [{ blockNumber: 'desc' }],
  });
  const highestSavedBlockNumber = highestSavedBlock
    ? highestSavedBlock.blockNumber - 1 // force to grab last block again in case of terminate previous scraping process
    : 0;

  const chain = await prisma.chain.findUnique({ where: { name: 'HydraDX' } });
  let lastGrabbedBlock = chain.lastGrabbedBlock;
  if (!lastGrabbedBlock) {
    lastGrabbedBlock = highestSavedBlockNumber;
  }

  // first of all let's deal with some inconsitence in previously grabbed data
  if (direction === 'GAPS') {
    logger.debug(
      `Try to find missing blocks between ${lowestSavedBlockNumber} and ${highestSavedBlockNumber}...`
    );

    logger.error(`Not implemented yet`);
  }

  if (direction === 'FROM_HIGHEST_SAVED_UP_TO_NEW') {
    // get highest block from the database
    const lastSavedBlock = await prisma.block.findFirst({
      orderBy: {
        number: 'desc',
      },
    });

    const lastHeader = (lastSavedBlock && lastSavedBlock.number) || 0;

    logger.log(
      `Grab payouts for blocks from ${highestSavedBlockNumber} to ${lastHeader}`
    );

    for (let i = highestSavedBlockNumber; i <= lastHeader; i++) {
      y++;
      await grabThisBlock(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_ACTUAL_TO_HIGHES_SAVED') {
    // get highest block from the database
    const lastSavedBlock = await prisma.block.findFirst({
      orderBy: {
        number: 'desc',
      },
    });

    const lastHeader = (lastSavedBlock && lastSavedBlock.number) || 0;

    logger.log(
      `Grab payouts for blocks from ${highestSavedBlockNumber} to ${lastHeader}`
    );

    for (let i = lastHeader; i >= highestSavedBlockNumber; i--) {
      y++;
      await grabThisBlock(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_LOWEST_SAVED_TO_ZERO') {
    // grab data for particular block
    for (let i = lowestSavedBlockNumber; i >= 0; i--) {
      y++;
      await grabThisBlock(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }
};

export default payoutsGrabber;
