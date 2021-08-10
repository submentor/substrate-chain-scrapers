import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolkadotService } from '../polkadot/polkadot.service';
import { prisma, Prisma, ChainUpdateType } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  calcValidatorsDetail,
  calcValidatorDetail,
  validatorNominatorsResult,
  calcNominatorsResult,
  calcNominatorDetail,
  nominatorValidatorsResult,
  caldPayoutsStatistics,
} from './chain.unitls';
import moment from 'moment';
import { validateOrReject } from 'class-validator';

@Injectable()
export class ChainService {
  constructor(
    @Inject(forwardRef(() => PolkadotService))
    private readonly dotService: PolkadotService,
    private readonly prisma: PrismaService
  ) {}
  private timeLogger: boolean =
    process.env.NODE_ENV !== 'production' ? true : false;
  private startTime;
  private endTime;
  private duration = 0;
  private totalDuration = 0;
  private readonly logger = new Logger(PolkadotService.name);

  getHello(): string {
    return 'Hello World!';
  }

  getHelloName(name: string): string {
    return `Hello ${name}!`;
  }

  async validators(args?: Prisma.ValidatorFindManyArgs) {
    if (this.timeLogger) {
      this.startTime = moment();
      this.logger.debug('prisma start');
    }
    const validators = await this.prisma.validator.findMany({
      ...args,
      include: {
        nominators: {
          include: {
            nominator: {
              select: {
                accountId: true,
                bonded: true,
                freeBalance: true,
                balance: true,
              },
            },
          },
        },
        identity: true,
        account: {
          include: {
            eraValidators: {
              orderBy: {
                eraIndex: 'desc',
              },
              take: 10,
            },
          },
        },
      },
    });

    if (this.timeLogger) {
      this.endTime = moment();
      this.duration = this.endTime.diff(this.startTime, 'miliseconds');
      this.totalDuration += this.duration;
      this.logger.debug(
        `prisma end -> duration ${this.duration} total duration ${this.totalDuration}`
      );
    }

    if (this.timeLogger) {
      this.startTime = moment();
      this.logger.debug('calcValidatorsDetail start');
    }

    const validatorsWithDetails = calcValidatorsDetail(validators);

    if (this.timeLogger) {
      this.endTime = moment();
      this.duration = this.endTime.diff(this.startTime, 'miliseconds');
      this.totalDuration += this.duration;
      this.logger.debug(
        `calcValidatorsDetail end -> duration ${this.duration} total duration ${this.totalDuration}`
      );
    }
    const result = [];

    return validatorsWithDetails;
  }

  async validatorDetail(validatorId: string) {
    const validator = await this.prisma.validator.findFirst({
      where: {
        id: validatorId,
      },
      include: {
        nominators: {
          include: {
            nominator: {
              select: {
                accountId: true,
                bonded: true,
                freeBalance: true,
                balance: true,
              },
            },
          },
        },
        identity: true,
        account: {
          include: {
            eraValidators: {
              orderBy: {
                eraIndex: 'desc',
              },
              take: 10,
            },
          },
        },
      },
    });

    return calcValidatorDetail(validator);
  }

  async validatorNominators(validatorId: string) {
    const validator = await this.prisma.validator.findFirst({
      where: {
        id: validatorId,
      },
      include: {
        nominators: {
          include: {
            nominator: {
              select: {
                accountId: true,
                bonded: true,
                freeBalance: true,
                balance: true,
              },
            },
          },
        },
      },
    });

    return validatorNominatorsResult(validator.nominators);
  }

  async nominators(args?: Prisma.NominatorFindManyArgs) {
    const count = await this.prisma.nominator.count({ where: args.where });

    let data = await this.prisma.nominator.findMany({
      ...args,
      include: {
        _count: {
          select: { validators: true },
        },
      },
    });

    data = calcNominatorsResult(data);

    const result = {
      data,
      count,
    };

    return result;
  }

  async nominatorDetail(nominatorId: string) {
    const nominator = await this.prisma.nominator.findFirst({
      where: {
        id: nominatorId,
      },
      include: {
        validators: {
          include: {
            validator: {
              select: {
                accountId: true,
                bonded: true,
                freeBalance: true,
                balance: true,
              },
            },
          },
        },
        identity: true,
        _count: {
          select: { validators: true },
        },
      },
    });

    return calcNominatorDetail(nominator);
  }

  async nominatorValidators(filter: any) {
    const { nominatorId, nominatorAddress } = filter;

    const where = {
      ...(nominatorId && { id: nominatorId }),
      ...(nominatorAddress && { accountId: nominatorAddress }),
    };

    const nominator = await this.prisma.nominator.findFirst({
      where,
      include: {
        validators: {
          include: {
            validator: {
              select: {
                id: true,
                accountId: true,
                bonded: true,
                freeBalance: true,
                balance: true,
                identity: true,
                commission: true,
                nominators: {
                  select: {
                    nominator: true,
                  },
                },
                account: {
                  include: {
                    eraValidators: {
                      orderBy: {
                        eraIndex: 'desc',
                      },
                      take: 10,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (nominator) {
      return nominatorValidatorsResult(nominator);
    } else {
      return [];
    }
  }

  async accounts(args?: Prisma.AccountFindManyArgs) {
    const count = await this.prisma.account.count({ where: args.where });
    let data = await this.prisma.account.findMany({
      ...args,
    });

    data = calcNominatorsResult(data); // should be used

    const result = {
      data,
      count,
    };

    return result;
  }

  // ERA
  async eras(args?: Prisma.EraFindManyArgs) {
    const count = await this.prisma.era.count({ where: args.where });
    let data = await this.prisma.era.findMany({
      ...args,
      include: {
        eraStartSession: {
          include: {
            startAtBlock: true,
          },
        },
      },
    });

    const result = {
      data,
      count,
    };

    return result;
  }

  async eraDetail(eraId: number) {
    const era = await this.prisma.era.findUnique({
      where: {
        index: eraId,
      },
      include: {
        eraStartSession: {
          include: {
            startAtBlock: true,
          },
        },
      },
    });
    return era;
  }

  // PAYOUTS
  async payoutsStatistics(accountAddress: string) {
    const payouts = await this.prisma.eraPayout.findMany({
      where: {
        accountAddress,
      },
    });

    const nominator = await this.prisma.nominator.findUnique({
      where: {
        accountId: accountAddress,
      },
    });

    const validator = await this.prisma.validator.findUnique({
      where: {
        accountId: accountAddress,
      },
    });

    if (!nominator && !validator) {
      return {
        ...{ id: accountAddress },
      };
    }

    let statistics = caldPayoutsStatistics(payouts);

    return {
      ...{ id: accountAddress },
      ...statistics,
      ...(nominator && {
        nominator: {
          bonded: nominator.bonded,
          freeBalance: nominator.freeBalance,
          balance: nominator.balance,
        },
      }),
      ...(validator && {
        validator: {
          bonded: validator.bonded,
          freeBalance: validator.freeBalance,
          balance: validator.balance,
          commission: validator.commission,
        },
      }),
    };
  }

  async payouts(args?: Prisma.EraPayoutFindManyArgs) {
    const count = await this.prisma.eraPayout.count({ where: args.where });
    let data = await this.prisma.eraPayout.findMany({
      ...args,
      include: {
        paidBy: {
          include: {
            identity: true,
          },
        },
      },
    });

    const result = {
      data,
      count,
    };

    return result;
  }

  async payoutsGen2(args?: Prisma.EraPayoutGen2FindManyArgs) {
    const count = await this.prisma.eraPayoutGen2.count({ where: args.where });
    const data = await this.prisma.eraPayoutGen2.findMany({
      ...args,
    });

    const result = {
      data,
      count,
    };

    return result;
  }

  // SYSTEM
  async startUpdateChain(type: ChainUpdateType) {
    const chain = await this.prisma.chain.findUnique({
      where: { name: 'HydraDX' },
    }); // TODO - get name from the config
    const now = new Date();
    if (chain) {
      await this.prisma.chainUpdates.upsert({
        where: {
          chainId_type: {
            chainId: chain.id,
            type,
          },
        },
        create: {
          chainId: chain.id,
          type,
          startedAt: now,
        },
        update: {
          startedAt: now,
          finishedAt: null,
        },
      });
    } else {
      throw new Error(`Chain HydraDX was not found`);
    }
  }

  async finishUpdateChain(type: ChainUpdateType) {
    const chain = await this.prisma.chain.findUnique({
      where: { name: 'HydraDX' },
    }); // TODO - get name from the config
    if (chain) {
      const now = new Date();
      await this.prisma.chainUpdates.update({
        where: {
          chainId_type: {
            chainId: chain.id,
            type,
          },
        },
        data: {
          finishedAt: now,
        },
      });
    } else {
      throw new Error(`Chain HydraDX was not found`);
    }
  }

  async getChainStatus() {
    const chain = await this.prisma.chain.findUnique({
      where: { name: 'HydraDX' },
    }); // TODO - get name from the config
    let updateStatus = [];

    if (chain) {
      const chainUpdates = await this.prisma.chainUpdates.findMany({});
      for (let update of chainUpdates) {
        let status = {
          job: update.type,
          startedAt: update.startedAt,
          finishedAt: update.finishedAt,
        };
        updateStatus.push(status);
      }
    } else {
      throw new Error(`Chain HydraDX was not found`);
    }

    const highestSavedBlock = await this.prisma.block.findFirst({
      orderBy: {
        number: 'desc',
      },
    });

    const highestSavedPayoutBlock = await this.prisma.eraPayout.findFirst({
      orderBy: {
        blockNumber: 'desc',
      },
    });

    const highestSavedRewardEvent = await this.prisma.event.findFirst({
      where: {
        section: 'staking',
        method: 'Reward',
      },
      orderBy: {
        blockNumber: 'desc',
      },
    });

    const chainStatusData = await this.dotService.getStatusData();

    const chainStatus = {
      updateStatus,
      chainData: chainStatusData,
      databaseData: {
        highestSavedBlock: highestSavedBlock?.number || 0,
        highestSavedBlockAt: highestSavedBlock?.startDateTime,
        highestSavedPayoutBlock: highestSavedPayoutBlock?.blockNumber || 0,
        highestSavedPayoutBlockAt: highestSavedPayoutBlock?.blockDate,
        highestSavedRewardEvent: highestSavedRewardEvent?.blockNumber || 0,
        highestSavedRewardEventAt: highestSavedRewardEvent?.blockDate,
      },
    };

    return chainStatus;
  }

  async getAccountsStatistics() {
    // it is not possible to groupBy date in prisma
    // so do the grouping by ourselves
    const accounts = await this.prisma.account.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000,
    });

    if (!accounts) return [];

    const firstDate = moment(accounts[0].createdAt);
    const lastDate = firstDate.subtract(25, 'days').endOf('day');

    const accountsByDate = accounts
      .filter((account) => moment(account.createdAt).isSameOrAfter(lastDate))
      .reduce(
        (
          stats: Array<{ date?: string; count?: number; amount: number }>,
          account
        ) => {
          const date = account.createdAt.getUTCDate();
          const month = account.createdAt.getUTCMonth() + 1;
          const dateMonth = `${date}/${month}`;
          const index = stats.findIndex((stat) => stat.date === dateMonth);
          if (index > -1) {
            stats[index].count++;
            stats[index].amount =
              stats[index].amount + account.balance.toNumber();
          } else {
            stats.push({
              date: dateMonth,
              count: 1,
              amount: account.balance.toNumber(),
            });
          }
          return stats;
        },
        []
      );

    return accountsByDate.reverse();
  }

  async getAccountsBalancesStats() {
    const accountsBalance = await this.prisma.account.aggregate({
      sum: {
        balance: true,
      },
      count: {
        id: true,
      },
    });

    const payoutsSum = await this.prisma.eraPayout.aggregate({
      sum: {
        payout: true,
      },
    });

    const payoutsSumGen2 = await this.prisma.eraPayoutGen2.aggregate({
      sum: {
        payout: true,
      },
    });

    return {
      accountsBalance,
      payoutsSum:
        payoutsSum.sum.payout.toNumber() + payoutsSumGen2.sum.payout.toNumber(),
    };
  }

  async validatorsHistory(args?: Prisma.ValidatorHistoryFindManyArgs) {
    const history = await this.prisma.$queryRaw(`
      SELECT h."id", val."accountId", val."commission" AS actual_commission, h."createdAt", h.commission AS prev_commission, i."display", i."displayParent" FROM "Validator" val
      left JOIN "Identity" i ON i."id" = val."identityId"
      LEFT JOIN "ValidatorHistory" h ON h."validatorId" = val."id"
      WHERE h."id" IS NOT NULL
      AND h."commission" <> val."commission"
      ORDER BY h."createdAt" DESC
      LIMIT 30
    `);

    const result = {
      data: history,
      count: history.length,
    };

    return result;
  }

  async eraCommissionHistory() {
    // find last era
    const lastEra = await this.prisma.eraValidator.findFirst({
      orderBy: {
        eraIndex: 'desc',
      },
      select: {
        eraIndex: true,
      },
    });
    const commissions = await this.prisma.eraValidator.findMany({
      where: {
        eraIndex: {
          gte: lastEra.eraIndex - 3,
        },
        commission: {
          gt: 10,
        },
      },
      orderBy: {
        eraIndex: 'desc',
      },
      include: {
        validator: {
          include: {
            identity: true,
            eraValidators: {
              take: 10,
              orderBy: {
                eraIndex: 'desc',
              },
            },
          },
        },
      },
      distinct: ['validatorAddress'],
    });
    return commissions;
  }

  async validatorCommission(validatorAddress: string, take?: number) {
    const validatorEraHistory = await this.prisma.eraValidator.findMany({
      where: {
        validatorAddress,
      },
      orderBy: {
        eraIndex: 'desc',
      },
      take: take || 10,
    });
    const eraPrefHistory = validatorEraHistory.reverse().map((item) => ({
      commission: item.commission,
      eraIndex: item.eraIndex,
    }));

    return eraPrefHistory;
  }

  // Find high commissions for allert
  async nominatorValidatorsStats(nominatorAddress: string) {
    let result = [];
    // find all validators for given nominator and last x eras
    const ERA_OFFSET = 5;
    const COMMISSION_LIMIT = -1; // this should be done at fronted
    const validators = await this.prisma.validatorsNominators.findMany({
      where: {
        nominator: {
          accountId: nominatorAddress,
        },
      },
      include: {
        validator: true,
      },
    });
    for (const validator of validators) {
      const validatorAccount = await this.prisma.account.findUnique({
        where: { accountId: validator.validator.accountId },
        include: {
          identity: true,
        },
      });
      const erasCommisions = await this.prisma.eraValidator.findMany({
        where: {
          validatorId: validatorAccount.id,
          commission: {
            gt: COMMISSION_LIMIT,
          },
        },
        orderBy: {
          eraIndex: 'desc',
        },
        take: ERA_OFFSET,
      });
      const eraPrefHistory = erasCommisions.reverse().map((item) => ({
        commission: item.commission,
        eraIndex: item.eraIndex,
      }));

      result.push({
        ...validatorAccount,
        eraPrefHistory,
      });
    }
    return {
      id: nominatorAddress,
      offset: ERA_OFFSET,
      limit: COMMISSION_LIMIT,
      data: result,
    };
  }
}
