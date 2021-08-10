import {
  ActiveEraInfo,
  Balance,
  EraIndex,
  Exposure,
  EventRecord,
} from '@polkadot/types/interfaces';

const DECIMAL_PLACES = 1000000000000; //TODO - get from config, but need to make injectable class. Now it seems to be a lot of new things to try and learn.

export const getIdentity = (identityInfo: any) => {
  return {
    display: identityInfo.display,
    parent: identityInfo.parent ? identityInfo.parent.toString() : null,
    displayParent: identityInfo.displayParent,
    email: identityInfo.email,
    web: identityInfo.web,
    legal: identityInfo.legal,
    twitter: identityInfo.twitter,
  };
};

export const convertBalance = (balance: Balance) => {
  //@ts-ignore
  const result = balance.toString() / DECIMAL_PLACES;
  return result;
};

export const filterEvents = (
  events: EventRecord[],
  _section: string,
  _method: string
): EventRecord[] => {
  return events.filter(
    ({ event: { method, section } }) =>
      section === _section && method === _method
  );
};

export const filterOutEvents = (
  events: EventRecord[],
  _section: string,
  _method: string
): EventRecord[] => {
  return events.filter(
    ({ event: { method, section } }) =>
      section !== _section && method !== _method
  );
};
