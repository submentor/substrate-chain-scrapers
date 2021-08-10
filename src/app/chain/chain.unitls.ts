import { Prisma, EraPayout } from '.prisma/client';

export const OVERSUBSCRIBED_LEVEL = 64;

export const validatorNominatorsResult = (validatorsNominators: Array<any>) => {
  let nominators = [];
  let i = 0;
  for (let validatorNominator of validatorsNominators) {
    i++;
    if (validatorNominator.nominator.accountId) {
      const bonded = validatorNominator.nominator.bonded.toNumber();
      const balance = validatorNominator.nominator.balance.toNumber();
      const freeBalance = validatorNominator.nominator.freeBalance.toNumber();
      nominators.push({
        id: validatorNominator.nominatorId,
        accountId: validatorNominator.nominator.accountId,
        bonded,
        balance,
        freeBalance,
      });
    }
  }

  nominators.sort((a, b) => (a.bonded < b.bonded ? 1 : -1));
  i = 0;
  for (const nominator of nominators) {
    nominators[i].sortOrder = i + 1;
    i++;
  }

  return nominators;
};

export const nominatorValidatorsResult = (nominator) => {
  let validators = [];
  let i = 0;
  const nominatorStake = nominator.bonded.toNumber();
  for (let nominatorValidator of nominator.validators) {
    const validator = nominatorValidator.validator;
    i++;
    if (validator) {
      // get statistics for actual validator
      const nominatorsOfValidator = [];
      let highest = 0;
      let lowest = 999999999999999;
      let overSubscribedLevel = 0;
      let totalNominatorsStake = 0;
      for (let nominatorOfValidatorArr of validator.nominators) {
        const nominatorOfValidator = nominatorOfValidatorArr.nominator;
        const bonded = nominatorOfValidator.bonded.toNumber();
        totalNominatorsStake += bonded;
        highest = bonded > highest ? bonded : highest;
        lowest = bonded < lowest ? bonded : lowest;
        nominatorsOfValidator.push({
          ...nominatorOfValidator,
          bonded,
        });
      }

      const bonded = validator.bonded.toNumber();
      const balance = validator.balance.toNumber();
      const freeBalance = validator.freeBalance.toNumber();
      const totalStake = totalNominatorsStake + bonded;
      const nominatorPercentage =
        totalStake > 0 ? nominatorStake / totalStake : 0;

      validators.push({
        ...validator,
        bonded,
        balance,
        freeBalance,
        highest,
        lowest,
        totalNominatorsStake,
        totalStake,
        nominatorPercentage,
      });
    }
  }

  validators.sort((a, b) =>
    a.nominatorPercentage < b.nominatorPercentage ? 1 : -1
  );
  i = 0;
  for (const validator of validators) {
    validators[i].sortOrder = i + 1;
    i++;
  }

  return validators;
};

export const calcValidatorDetail = (validator) => {
  let highest = 0;
  let lowest = 999999999999999;
  let overSubscribedLevel = 0;
  let nominatorsStake = 0;
  let i = 0;
  let nominators = [];
  for (let validatorNominator of validator.nominators) {
    i++;
    if (validatorNominator.nominator.accountId) {
      const bonded = validatorNominator.nominator.bonded.toNumber();
      const freeBalance = validatorNominator.nominator.freeBalance.toNumber();
      const balance = validatorNominator.nominator.balance.toNumber();
      nominatorsStake += bonded;
      highest = bonded > highest ? bonded : highest;
      lowest = bonded < lowest ? bonded : lowest;
      nominators.push({
        id: validatorNominator.nominatorId,
        accountId: validatorNominator.nominator.accountId,
        bonded,
        balance,
        freeBalance,
      });
    }
  }

  nominators.sort((a, b) => (a.bonded < b.bonded ? 1 : -1));
  overSubscribedLevel = nominators[OVERSUBSCRIBED_LEVEL - 1]
    ? nominators[OVERSUBSCRIBED_LEVEL - 1].bonded
    : 0;

  validator.nominators = nominators;

  if (validator.account.eraValidators) {
    const eraPrefHistory = validator.account.eraValidators
      .reverse()
      .map((item) => ({
        commission: item.commission,
        eraIndex: item.eraIndex,
      }));
    validator.account.eraValidators = eraPrefHistory;
  }

  validator = {
    ...validator,
    balance: validator.balance.toNumber(),
    freeBalance: validator.freeBalance.toNumber(),
    bonded: validator.bonded.toNumber(),
    ...{
      overSubscribed: validator.nominators.length > 64 ? true : false,
      numberOfNominators: i,
      nominatorsStake,
      highestNominatorStake: highest,
      lowestNominatorStake: lowest,
      overSubscribedLevel,
    },
    totalStake: nominatorsStake + validator.bonded.toNumber(),
  };

  return validator;
};

export const calcValidatorsDetail = (
  validators: Array<any>,
  args?: Prisma.ValidatorFindManyArgs
) => {
  let result = [];

  for (let validator of validators) {
    result.push(calcValidatorDetail(validator));
  }

  // sorting desc
  result.sort((a, b) => (a.totalStake < b.totalStake ? 1 : -1));
  for (let i = 0; i < result.length; i++) {
    result[i].sortOrder = i + 1;
  }

  return result;
};

export const calcNominatorsResult = (
  nominators: Array<any>,
  sort?: { key: string; order: 'asc' | 'desc' }
) => {
  let sortOrder = 0;
  const nominatorsResult = [];

  if (sort) {
    const key = Object.keys(sort)[0];
    const order = sort[key];

    nominators.sort((a, b) =>
      order === 'asc' ? a[key] - b[key] : b[key] - a[key]
    );
  }

  for (const nominator of nominators) {
    sortOrder++;
    nominatorsResult.push({
      ...nominator,
      balance: nominator.balance.toNumber(),
      freeBalance: nominator.freeBalance.toNumber(),
      bonded: nominator.bonded.toNumber(),
      ...{ sortOrder },
    });
  }
  return nominatorsResult;
};

export const calcNominatorDetail = (nominator) => {
  return nominator;
};

export const caldPayoutsStatistics = (payouts: EraPayout[]) => {
  let statistics = {
    totalPayouts: 0,
    noOfPayouts: 0,
    firstEra: 9999999999,
    lastEra: 0,
    maxPayout: 0,
    minPayout: 9999999999,
    averagePayout: 0,
    validatorsStats: {},
  };

  payouts.forEach((current: EraPayout) => {
    (statistics.totalPayouts += current.payout.toNumber()),
      (statistics.noOfPayouts += 1),
      (statistics.firstEra = Math.min(
        statistics.firstEra,
        current.paidForEraIndex
      )),
      (statistics.lastEra = Math.max(
        statistics.firstEra,
        current.paidForEraIndex
      )),
      (statistics.maxPayout = Math.max(
        statistics.maxPayout,
        current.payout.toNumber()
      )),
      (statistics.minPayout = Math.min(
        statistics.minPayout,
        current.payout.toNumber()
      )),
      (statistics.averagePayout =
        statistics.totalPayouts / statistics.noOfPayouts);

    // group validators by
  });

  if (statistics.totalPayouts === 0) {
    statistics.maxPayout = 0;
    statistics.minPayout = 0;
    statistics.firstEra = 0;
  }

  return statistics;
};
