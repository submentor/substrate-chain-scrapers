import { ApiPromise } from '@polkadot/api';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { Direction } from './index';
import { convertBalance } from '../polkadot.utils';
import { Prisma } from '@prisma/client';

const logger = new Logger('EraGrabber');

interface grabberOptions {
  type: 'EXACT' | 'RANGE';
  exactNumber?: number;
  higherRangeNumber?: number;
  lowerRangeNumber?: number;
}

const payoutsGrabber = async (
  api: ApiPromise,
  prisma: PrismaService,
  direction: Direction,
  options?: grabberOptions
) => {
  const currentEra = await api.query.staking.currentEra();
  const currentEraNr = currentEra.unwrapOrDefault().toNumber();

  const grabEraPayouts = async (eraNumber: number) => {
    logger.log(`Grabber: Payouts for Era ${eraNumber} `);

    try {
      // ERAS PAYOUTS - used for batch payouts scraping

      // fist find the era starting and ending date
      // because we only have era starting date, we need to compare
      // two ereas in sequence. So we have eraNumber param and try to get higher era

      const requestedEra = await prisma.era.findUnique({
        where: {
          index: eraNumber,
        },
      });

      const higherEra = await prisma.era.findUnique({
        where: {
          index: eraNumber + 1,
        },
      });

      if (higherEra && requestedEra) {
        let eraStartedAtBlock;
        let eraEndedAtBlock;
        const endSession = await prisma.session.findUnique({
          where: {
            index: higherEra.eraStartSessionIndex,
          },
          include: {
            startAtBlock: true,
          },
        });
        if (endSession) {
          eraEndedAtBlock = endSession.startBlockNumber - 1;
        }

        // era
        const startSession = await prisma.session.findUnique({
          where: {
            index: requestedEra.eraStartSessionIndex,
          },
          include: {
            startAtBlock: true,
          },
        });
        if (startSession) {
          eraStartedAtBlock = startSession.startBlockNumber;
        }

        if (eraStartedAtBlock && eraEndedAtBlock) {
          await prisma.eraPayout.deleteMany({
            where: {
              madeInEraIndex: eraNumber,
            },
          });

          // find relevant extrinsics between block range
          const exs = await prisma.extrinsic.findMany({
            where: {
              AND: [
                {
                  blockNumber: {
                    gte: eraStartedAtBlock,
                  },
                },
                {
                  blockNumber: {
                    lte: eraEndedAtBlock,
                  },
                },
              ],
              section: 'staking',
              method: 'payoutStakers',
            },
          });

          for (let ex of exs) {
            // find relevant events for payoutStakers extrinsics
            const events = await prisma.event.findMany({
              where: {
                blockNumber: ex.blockNumber,
                applyExtrinsic: ex.index,
                section: 'staking',
                method: 'Reward',
              },
            });

            const paidByAddres = ex.args[0];
            const paidBy = await prisma.account.findUnique({
              where: {
                accountId: paidByAddres,
              },
            });
            const paidForEraIndex = parseInt(ex.args[1]);

            if (events.length > 0) {
              logger.log(
                `Grabber: Era ${eraNumber}, block number ${ex.blockNumber}, extrinsics ${ex.index}, paid for era ${paidForEraIndex} has ${events.length} payouts events to grab.`
              );
            } else {
              logger.warn(
                `There are no events for payoutStakers extrinsic ${ex.index} block number ${ex.blockNumber}`
              );
            }

            let y = 0;
            for (let event of events) {
              const payoutRecord: Prisma.EraPayoutCreateInput = {
                madeInEra: {
                  connect: {
                    index: eraNumber,
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
                paidBy: {
                  connect: {
                    id: paidBy.id,
                  },
                },
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
        }
      } else {
        logger.log(
          `Grabber: Payouts for Era ${eraNumber} skiped. There is no higher or this era in the database`
        );
      }
    } catch (e) {
      logger.error(e.message);
    }
  };

  const NO_OF_TESTING_RECORDS = 100000000;

  const grabThisNumber = async (i) => {
    await prisma.eraPayout.deleteMany({
      where: {
        madeInEraIndex: i,
      },
    });
    await grabEraPayouts(i);
  };

  // we will go through saved eras and try grab payouts
  const lowestSavedEra = await prisma.era.findFirst({
    orderBy: [{ index: 'asc' }],
  });
  const lowestSavedEraIndex = lowestSavedEra ? lowestSavedEra.index : 0;

  const highestSavedEra = await prisma.era.findFirst({
    orderBy: [{ index: 'desc' }],
  });
  const highestSavedEraIndex = highestSavedEra ? highestSavedEra.index : 0;

  let y = 0;

  if (direction === 'EXACT') {
    const exactNumber =
      options && options.type === 'EXACT' && options.exactNumber;
    if (!exactNumber) {
      console.log(`You have to provide exact era number`);
      return;
    }
    await grabThisNumber(exactNumber);
  }

  if (direction === 'RANGE_HIGHER_TO_LOWER') {
    const higherNumber =
      options && options.type === 'RANGE' && options.higherRangeNumber;
    const lowerNumber =
      options && options.type === 'RANGE' && options.lowerRangeNumber;

    if (!higherNumber && !lowerNumber) {
      console.warn(`Range of the eras to grab must be set`);
      return;
    }

    for (let i = higherNumber; i >= lowerNumber; i--) {
      y++;
      await grabThisNumber(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_HIGHEST_SAVED_UP_TO_NEW') {
    // grab data for particular block
    for (let i = highestSavedEraIndex; i >= currentEraNr; i++) {
      y++;

      await grabThisNumber(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_ACTUAL_TO_HIGHES_SAVED') {
    // grab data for particular block
    for (let i = currentEraNr; i >= highestSavedEraIndex; i--) {
      y++;

      await grabThisNumber(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_LOWEST_SAVED_TO_ZERO') {
    // grab data for particular block
    for (let i = lowestSavedEraIndex; i >= 0; i--) {
      y++;
      await grabThisNumber(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }
};

export default payoutsGrabber;
