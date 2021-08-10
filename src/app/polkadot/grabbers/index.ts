import blockGrabber from './block';
import sessionGrabber from './session';
import eraGrabber from './era';
import payoutsGrabber from './payouts-by-block';

export type Direction =
  | 'FROM_HIGHEST_SAVED_UP_TO_NEW'
  | 'FROM_ACTUAL_TO_HIGHES_SAVED'
  | 'FROM_LOWEST_SAVED_TO_ZERO'
  | 'GAPS'
  | 'RANGE_HIGHER_TO_LOWER'
  | 'EXACT'
  | 'ARRAY';

export const grabbers = {
  blockGrabber,
  sessionGrabber,
  eraGrabber,
  payoutsGrabber,
};

export const startGrabber = (
  grabberName: string,
  api,
  prisma,
  direction: Direction
) => {
  grabbers[grabberName](api, prisma, direction);
};
