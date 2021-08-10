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
import { ConflictException, Logger } from '@nestjs/common';
import moment from 'moment';
import { Direction } from './index';
import { convertBalance } from '../polkadot.utils';
import { PolkadotService } from '../polkadot.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '.prisma/client';


interface grabberOptions {
  type: 'EXACT' | 'RANGE';
  exactNumber?: number;
  higherRangeNumber?: number;
  lowerRangeNumber?: number;
}

const logger = new Logger('EraGrabber');
const config = new ConfigService();

const eraGrabber = async (
  api: ApiPromise,
  prisma: PrismaService,
  direction: Direction,
  options?: grabberOptions
) => {
  //const activeEra = await api.query.staking.activeEra(); // take Active (rewarded era not Current)
  //const currentEraNr = activeEra.unwrap().index.toNumber();

  /**
   * if the currentEra is greater than activeEra then the currentEra is going to
   * start in the near future (within 4 hours). Era Start Session Index is greater than
   * last saved session index because this Session is in the future.
   */
  const currentEra = await api.query.staking.currentEra();
  const currentEraNr = currentEra.unwrap().toNumber();

  const grabEra = async (eraNumber: number) => {
    logger.log(`Grabber: Era ${eraNumber} `);
    let valCounter = 0;

    const historyDepth = await (
      await api.query.staking.historyDepth()
    ).toNumber();

    if (currentEraNr - eraNumber < historyDepth) {
      const currentEraStartSessionIndexOpt = await api.query.staking.erasStartSessionIndex(
        eraNumber
      );

      const currentEraStartSessionIndex = currentEraStartSessionIndexOpt
        .unwrap()
        .toNumber();

      const isSessionSaved = await prisma.session.findFirst({
        where: {
          index: currentEraStartSessionIndex,
        },
      });

      if (isSessionSaved) {
        const points = await api.query.staking.erasRewardPoints(eraNumber);
        const totalStakeBalance = await api.query.staking.erasTotalStake(
          eraNumber
        );
        const totalStake = convertBalance(totalStakeBalance);

        const validatorsRewardsBal = await api.query.staking.erasValidatorReward(
          eraNumber
        );
        const validatorsRewards = convertBalance(
          validatorsRewardsBal.unwrapOrDefault()
        );

        // we would like to upsert existed era, because
        // first we could save era withouts erasRewards
        await prisma.era.upsert({
          where: {
            index: eraNumber,
          },
          create: {
            index: eraNumber,
            totalPoints: points.total.toNumber(),
            eraStartSessionIndex: currentEraStartSessionIndex,
            totalStake,
            validatorsRewards,
            validatorsArrLength: Object.keys(points.individual.toJSON()).length,
          },
          update: {
            totalPoints: points.total.toNumber(),
            eraStartSessionIndex: currentEraStartSessionIndex,
            totalStake,
            validatorsRewards,
            validatorsArrLength: Object.keys(points.individual.toJSON()).length,
          },
        });

        // ERA HISTORY

        // first delete all data to get new snapshot
        await prisma.eraValidator.deleteMany({
          where: {
            eraIndex: eraNumber,
          },
        });
        await prisma.eraNominator.deleteMany({
          where: {
            eraIndex: eraNumber,
          },
        });

        // individual points are available only in active Era
        // but not available in currentEra. This number changes during era time
        // as long as validators earn new points. So it should be grabbed after
        // era finished.
        const individualPoints = points.individual.toJSON();

        const createEraValidators = async (
          validatorAddr: string,
          points?: any
        ) => {
          let rawValidator: Prisma.EraValidatorCreateInput;

          const pref = await api.query.staking.erasValidatorPrefs(
            eraNumber,
            validatorAddr
          );
          const stakers = await api.query.staking.erasStakers(
            eraNumber,
            validatorAddr
          );
          const stakersArr = stakers.others.toJSON() as Array<Record<any, any>>;
          const validator = await prisma.account.findUnique({
            where: { accountId: validatorAddr },
          });
          rawValidator = {
            era: {
              connect: {
                index: eraNumber,
              },
            },
            points: parseFloat(points.toString()),
            commission: pref.commission.toNumber() / 10000000,
            blocked: pref.blocked.isTrue ? true : false,
            totalStake: convertBalance(stakers.total.unwrap()),
            ownStake: convertBalance(stakers.own.unwrap()),
            othersStake:
              convertBalance(stakers.total.unwrap()) -
              convertBalance(stakers.own.unwrap()),
            ...(validator && {
              validator: {
                connect: {
                  id: validator.id,
                },
              },
            }),
            validatorAddress: validatorAddr,
            nominatorsArrLength: stakersArr.length,
          };
          await prisma.eraValidator.create({ data: rawValidator });

          logger.log(
            `(${valCounter}) Era ${eraNumber} validator ${validatorAddr} has ${stakersArr.length} stakers`
          );

          for (const stakerObj of stakersArr) {
            const nominator = await prisma.account.findUnique({
              where: { accountId: stakerObj['who'] },
            });

            let rawNominator: Prisma.EraNominatorCreateInput = {
              era: {
                connect: {
                  index: eraNumber,
                },
              },
              ...(validator && {
                validator: {
                  connect: {
                    id: validator.id,
                  },
                },
              }),
              validatorAddress: validatorAddr,
              ...(nominator && {
                nominator: {
                  connect: {
                    id: nominator.id,
                  },
                },
              }),
              nominatorAddress: stakerObj['who'],
              bonded: convertBalance(stakerObj['value']),
            };

            await prisma.eraNominator.create({ data: rawNominator });
          }
        };

        valCounter = 0;
        if (!individualPoints || individualPoints.length === 0) {
          // we have only current era information
          const validators = await api.query.session.validators();
          for (let validatorAddr of validators) {
            valCounter++;
            await createEraValidators(validatorAddr.toString());
          }
        }

        valCounter = 0;
        for (const [validatorAddr, points] of Object.entries(
          individualPoints
        )) {
          valCounter++;
          await createEraValidators(validatorAddr, points);
        }
      } else {
        logger.debug(
          `Era ${eraNumber} cannot be saved. Session ${currentEraStartSessionIndex} has not been already grabbed and saved`
        );
      }
    } else {
      logger.error(`Eras history depth ${historyDepth} has been exceeded`);
    }
  };

  const NO_OF_TESTING_RECORDS = 1000000;

  let y = 0;

  // GrabExact Block by number
  if (direction === 'EXACT') {
    const exactNumber =
      options && options.type === 'EXACT' && options.exactNumber;
    if (!exactNumber) {
      console.log(`You have to provide exact block number`);
      return;
    }
    await grabEra(exactNumber);
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

      await grabEra(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  // find first saved era by Era ID
  const lowestSavedEra = await prisma.era.findFirst({
    orderBy: [{ index: 'asc' }],
  });
  const lowestSavedEraIndex = lowestSavedEra ? lowestSavedEra.index : 0;

  // find last saved era by Era ID
  const highestSavedEra = await prisma.era.findFirst({
    orderBy: [{ index: 'desc' }],
  });
  const highestSavedEraIndex = highestSavedEra ? highestSavedEra.index : 0;

  if (direction === 'GAPS') {
    logger.debug(
      `Try to find missing eras between ${lowestSavedEraIndex} and ${highestSavedEraIndex}...`
    );
    for (let i = highestSavedEraIndex; i >= lowestSavedEraIndex; i--) {
      y++;
      process.stdout.write(
        `\r${y} / ${highestSavedEraIndex - lowestSavedEraIndex + 1} `
      );
      let existedEra = await prisma.era.findFirst({
        where: {
          index: i,
        },
      });
      if (!existedEra) {
        await grabEra(i);
      }

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }

    logger.debug(
      `Finished grabbing missing eras between ${lowestSavedEraIndex} and ${highestSavedEraIndex}`
    );
  }

  if (direction === 'FROM_HIGHEST_SAVED_UP_TO_NEW') {
    // grab data for particular block
    for (let i = highestSavedEraIndex; i <= currentEraNr; i++) {
      y++;

      await grabEra(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_ACTUAL_TO_HIGHES_SAVED') {
    // grab data for particular block
    for (let i = currentEraNr; i >= highestSavedEraIndex; i--) {
      y++;

      await grabEra(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_LOWEST_SAVED_TO_ZERO') {
    // grab data for particular block
    for (let i = lowestSavedEraIndex - 1; i >= 0; i--) {
      y++;

      await grabEra(i);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }
};

export default eraGrabber;
