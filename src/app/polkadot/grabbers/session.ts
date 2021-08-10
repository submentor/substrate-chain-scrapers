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

const logger = new Logger('sessionGrabber');

const sessionGrabber = async (api: ApiPromise, prisma: PrismaService) => {
  const lastHeader = await api.rpc.chain.getHeader();

  const grabSession = async (blockNumber: number) => {
    const blockHash: Hash = await api.rpc.chain.getBlockHash(blockNumber);
    const sessionIndex = await api.query.session.currentIndex.at(blockHash);
    const startDateTime: Moment = await api.query.timestamp.now.at(blockHash);

    logger.log(
      `Grabber: session: ${sessionIndex} at ${moment(
        startDateTime.toNumber()
      ).format('dddd, MMMM Do YYYY, h:mm:ss a')} hash ${blockHash}`
    );

    // create Session record
    let existedSession = await prisma.session.findFirst({
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
  };

  // find last saved session by startBlockNumber
  const lastSavedBlock = await prisma.session.findFirst({
    orderBy: [{ startBlockNumber: 'desc' }],
  });
  const lastSavedBlockNumber = lastSavedBlock
    ? lastSavedBlock.startBlockNumber
    : 0;

  let y = 0;
  // grab data for particular block
  for (let i = lastHeader.number.toNumber(); i >= lastSavedBlockNumber; i--) {
    y++;
    logger.debug(`Block number: ${i}`);

    await grabSession(i);

    // TODO - only for debug
    if (process.env.NODE_ENV !== 'production' && y > 10) break;
  }
};

export default sessionGrabber;
