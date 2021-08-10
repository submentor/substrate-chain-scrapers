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

const logger = new Logger('blockGrabber');

interface blockGrabberOptions {
  type: 'EXACT' | 'RANGE' | 'ARRAY';
  exactNumber?: number;
  higherRangeNumber?: number;
  lowerRangeNumber?: number;
  array?: Array<number>;
}

const blockGrabber = async (
  api: ApiPromise,
  prisma: PrismaService,
  direction: Direction,
  options?: blockGrabberOptions
) => {
  await api.isReady;

  const grabBlock = async (blockNumber: number, existedBlock) => {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockNumber);
    const sessionIndex = await api.query.session.currentIndex.at(blockHash);
    const startDateTime: Moment = await api.query.timestamp.now.at(blockHash);
    const events = await api.query.system.events.at(blockHash);
    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const extrinsics = signedBlock.block.extrinsics;

    logger.log(
      `Grabber: block ${blockNumber} created at ${moment(
        startDateTime.toNumber()
      ).toString()}`
    );

    // create Block record
    try {
      if (!existedBlock) {
        existedBlock = await prisma.block.create({
          data: {
            number: blockNumber,
            hash: blockHash.toString(),
            startDateTime: new Date(startDateTime.toNumber()),
          },
        });
      }

      // create Session connected with block
      let existedSession = await prisma.session.findUnique({
        where: {
          index: sessionIndex.toNumber(),
        },
      });
      if (!existedSession) {
        existedSession = await prisma.session.create({
          data: {
            index: sessionIndex.toNumber(),
            startBlockNumber: blockNumber,
          },
        });
      }

      // Save Events
      //const requiredEvents = filterOutEvents(events, 'staking', 'Reward');  // we can filter or filterOut events
      // for now let's grab all events
      const requiredEvents = events;

      if (requiredEvents.length > 0) {
        logger.log(
          `Grabber: ${
            requiredEvents.length
          } events for ${blockNumber} created at ${moment(
            startDateTime.toNumber()
          ).toString()}`
        );

        // first delete previsously saved events
        // this is helpful in case of datamodel changes or event types
        await prisma.event.deleteMany({
          where: {
            blockNumber: blockNumber,
          },
        });
      }

      let i = 0;
      for (let eventRecord of requiredEvents) {
        const { event, phase, topics } = eventRecord;
        const { method, section } = event;
        const eventIndex = event.index.toString();
        let applyExtrinsicJson = phase.isApplyExtrinsic && phase.toJSON();
        let applyExtrinsic = applyExtrinsicJson['applyExtrinsic'];
        let existedEvent = await prisma.event.findUnique({
          where: {
            index_blockNumber: {
              index: i,
              blockNumber: blockNumber,
            },
          },
        });
        if (!existedEvent) {
          const eventData = event.data.toJSON();
          existedEvent = await prisma.event.create({
            data: {
              index: i,
              eventIndex,
              blockNumber: blockNumber,
              blockDate: new Date(startDateTime.toNumber()),
              data: eventData,
              method,
              section,
              applyExtrinsic,
              topics: topics.toHuman(),
              phase: phase.toHuman(),
            },
          });
        }

        i++;
      }

      // Save Extrinsics
      //const requiredExtrinsics = filterOutExtrincis(events, 'staking', 'Reward');  // we can filter or filterOut Extrinsics
      // for now let's grab all Extrinsics
      const requiredExtrinsics = extrinsics;

      if (requiredExtrinsics.length > 0) {
        logger.log(
          `Grabber: ${
            requiredExtrinsics.length
          } extrinsics for ${blockNumber} created at ${moment(
            startDateTime.toNumber()
          ).toString()}`
        );

        // first delete previsously saved extrinsic
        // this is helpful in case of datamodel changes or event types
        await prisma.extrinsic.deleteMany({
          where: {
            blockNumber: blockNumber,
          },
        });
      }

      i = 0;
      for (let ex of extrinsics) {
        const exHuman = ex.toHuman();

        const { method: globalMethod, isSigned, signer } = ex;
        //@ts-ignore
        const { args, method, section } = globalMethod.toHuman();

        let existedEx = await prisma.extrinsic.findUnique({
          where: {
            index_blockNumber: {
              index: i,
              blockNumber: blockNumber,
            },
          },
        });
        if (!existedEx) {
          //@ts-ignore
          const argsData = args;
          existedEx = await prisma.extrinsic.create({
            data: {
              index: i,
              block: {
                connect: {
                  number: blockNumber,
                },
              },
              method,
              section,
              blockDate: new Date(startDateTime.toNumber()),
              //@ts-ignore
              args: argsData,
              isSigned: ex.isSigned,
              signer: signer.toString(),
              nonce: ex.nonce.toBigInt(),
              tip: convertBalance(ex.tip.unwrap()),
            },
          });
        }
        i++;
      }
    } catch (e) {
      console.log(e.message);
    }
  };

  const NO_OF_TESTING_RECORDS = 10000000;
  let y = 0;
  let existedBlock;

  // GrabExact Block by number
  if (direction === 'EXACT') {
    const exactNumber =
      options && options.type === 'EXACT' && options.exactNumber;
    if (!exactNumber) {
      console.log(`You have to provide exact block number`);
      return;
    }
    existedBlock = await prisma.block.findFirst({
      where: { number: exactNumber },
    });
    await grabBlock(exactNumber, existedBlock);
  }

  if (direction === 'ARRAY') {
    const array = options && options.type === 'ARRAY' && options.array;
    if (!array) {
      console.log(`You have to provide blocks array`);
      return;
    }
    for (let number of array) {
      existedBlock = await prisma.block.findFirst({
        where: { number },
      });
      await grabBlock(number, existedBlock);
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
      logger.debug(`Block number: ${i}`);

      existedBlock = await prisma.block.findFirst({
        where: { number: i },
      });
      await grabBlock(i, existedBlock);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  // get first and last saved block from database
  const lowestSavedBlock = await prisma.block.findFirst({
    orderBy: [{ number: 'asc' }],
  });
  const lowestSavedBlockNumber = lowestSavedBlock ? lowestSavedBlock.number : 0;

  let highestSavedBlock = await prisma.block.findFirst({
    orderBy: [{ number: 'desc' }],
  });
  let highestSavedBlockNumber = highestSavedBlock
    ? highestSavedBlock.number - 1 // force to grab last block again in case of terminate previous scraping process
    : 0;

  const chain = await prisma.chain.findUnique({
    where: { name: process.env.CHAIN_NAME },
  });
  let lastGrabbedBlock = chain && chain.lastGrabbedBlock;
  if (!lastGrabbedBlock) {
    lastGrabbedBlock = highestSavedBlockNumber;
  }

  // first of all let's deal with some inconsitence in previously grabbed data
  if (direction === 'GAPS') {
    logger.debug(
      `Try to find missing blocks between ${lowestSavedBlockNumber} and ${highestSavedBlockNumber}...`
    );

    for (let i = lastGrabbedBlock; i >= lowestSavedBlockNumber; i--) {
      y++;
      process.stdout.write(
        `\r${y} / ${highestSavedBlockNumber - lowestSavedBlockNumber + 1} `
      );
      existedBlock = await prisma.block.findFirst({
        where: { number: i },
      });
      if (!existedBlock) {
        logger.debug(`Fill missing block number: ${i}`);
        await grabBlock(i, existedBlock);

        await prisma.chain.update({
          where: {
            name: 'HydraDX',
          },
          data: {
            lastGrabbedBlock: i,
          },
        });
      }

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
    logger.debug(
      `Finished filling blocks gaps between ${lowestSavedBlockNumber} and ${highestSavedBlockNumber}`
    );
  }

  if (direction === 'FROM_HIGHEST_SAVED_UP_TO_NEW') {
    console.log('Hereee', direction);
    const getBlockInLoop = async (lastHeader, highestSavedBlockNumber) => {
      for (let i = highestSavedBlockNumber; i <= lastHeader; i++) {
        y++;
        logger.debug(`Block number: ${i}`);

        existedBlock = await prisma.block.findFirst({
          where: { number: i },
        });
        await grabBlock(i, existedBlock);

        // TODO - only for debug
        if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
          break;
      }
    };

    do {
      // get newNumbers
      const lastHeader = await api.rpc.chain.getHeader();
      let lastHeaderNumber = lastHeader.number.toNumber();

      highestSavedBlock = await prisma.block.findFirst({
        orderBy: [{ number: 'desc' }],
      });
      highestSavedBlockNumber = highestSavedBlock
        ? highestSavedBlock.number
        : 0;
      if (highestSavedBlockNumber < lastHeaderNumber) {
        y = 0;
        logger.debug(
          `Block from: ${highestSavedBlockNumber} to: ${lastHeaderNumber} `
        );
        // for insurance grab lastsaved block again (in case of terminate process)
        let moveBlock = 0;
        // but for development go on last saved
        if (process.env.NODE_ENV !== 'production') moveBlock = 1;
        await getBlockInLoop(
          lastHeaderNumber,
          highestSavedBlockNumber + moveBlock
        );
      } else {
        const waiting = async () => {
          const SEC = 24;
          logger.log(`Waiting for new blocks...`);
          //await waitForPromise(SEC * 1000);
        };

        await waiting();
        // const promises = [];
        // for (let x = 0; x <= SEC; x++) {
        //   promises.push(waitForPromise(1000));
        // }
        // await Promise.all(promises);
      }
    } while (true);
  }

  if (direction === 'FROM_ACTUAL_TO_HIGHES_SAVED') {
    // get last block from database

    const lastHeader = await (
      await api.rpc.chain.getHeader()
    ).number.toNumber();

    await prisma.chain.update({
      where: {
        name: 'HydraDX',
      },
      data: {
        lastGrabbedBlock: null,
      },
    });

    // Go from last chain block to last saved block
    // means grab a pretty new data
    for (let i = lastHeader; i >= highestSavedBlockNumber; i--) {
      y++;
      logger.debug(`Block number: ${i}`);

      existedBlock = await prisma.block.findFirst({
        where: { number: i },
      });
      await grabBlock(i, existedBlock);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }

  if (direction === 'FROM_LOWEST_SAVED_TO_ZERO') {
    // grab data for particular block
    for (let i = lowestSavedBlockNumber; i >= 0; i--) {
      y++;
      logger.debug(`Block number: ${i}`);

      existedBlock = await prisma.block.findFirst({
        where: { number: i },
      });
      await grabBlock(i, existedBlock);

      // TODO - only for debug
      if (process.env.NODE_ENV !== 'production' && y > NO_OF_TESTING_RECORDS)
        break;
    }
  }
};

export default blockGrabber;
