import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { BlockNumber, Hash, Moment } from '@polkadot/types/interfaces';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActiveEraInfo,
  Balance,
  EraIndex,
  Exposure,
} from '@polkadot/types/interfaces';
import { hexToString } from '@polkadot/util';
import BN from 'bn.js';
import { PrismaService } from '../prisma/prisma.service';
import { ChainConfig } from 'src/configs/config.interface';
import { convertBalance, getIdentity } from './polkadot.utils';
import { grabbers, startGrabber, Direction } from './grabbers';
import { ChainService } from '../chain/chain.service';
import { chainTypes } from '../../chain-types';
import { Prisma } from '@prisma/client';

@Injectable()
export class PolkadotService implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => ChainService))
    private readonly chainService: ChainService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  public api: ApiPromise;
  public decimalPlaces: number;
  private denom: string;
  private readonly logger = new Logger(PolkadotService.name);

  async onModuleInit() {
    Logger.log('Connecting to substrate chain...');
    const chainConfig = this.configService.get<ChainConfig>('chain');
    this.decimalPlaces = chainConfig.decimalPlaces;
    this.denom = chainConfig.denom;

    const wsProvider = new WsProvider(chainConfig.wsEndPoint);
    const providerOptions = {
      provider: wsProvider,
      types: chainTypes,
    };
    this.api = await ApiPromise.create(providerOptions);
  }

  async getStatusData() {
    await this.api.isReady;

    const chain = await this.api.rpc.system.chain();
    const nodeName = await this.api.rpc.system.name();
    const nodeVersion = await this.api.rpc.system.version();
    const header = await this.api.rpc.chain.getHeader();
    const now = await this.api.query.timestamp.now(); // return time from UTC
    const activeEra = await this.api.query.staking.activeEra();

    return {
      chain,
      nodeName,
      nodeVersion,
      headerNumber: header.number.toNumber(),
      now: now.toNumber(),
      activeEra: activeEra.unwrap().index,
    };
  }

  async getValidators() {
    await this.api.isReady;

    await this.chainService.startUpdateChain('VALIDATOR');

    type IdentityType = {
      info: {
        display: {
          Raw?: string;
          none?: null;
        };
        web: {
          Raw?: string;
          none?: null;
        };
        twitter: {
          Raw?: string;
          none?: null;
        };
        legal: {
          Raw?: string;
          none?: null;
        };
      };
    };

    const validatorsArr = [];
    const keys = await this.api.query.staking.validators.keys();
    const validatorsIds = keys.map(({ args: [validatorId] }) => validatorId);

    console.log('Go through validators ...');

    for (let i = 0; i < validatorsIds.length; i++) {
      const validatorDetail = await this.api.derive.balances.account(
        validatorsIds[i]
      );
      const validatorDetail2 = await this.api.derive.staking.account(
        validatorsIds[i]
      );
      const validatorIdentity = await this.api.derive.accounts.info(
        validatorsIds[i]
      );
      const identityRaw = getIdentity(validatorIdentity.identity);

      console.log(
        `\x1b[1m -> Validator ${
          validatorDetail.accountId
        } bonded balance is ${convertBalance(validatorDetail.frozenFee)} ${
          this.denom
        }`
      );

      // upsert Identity Information
      const identity = await this.prisma.identity.upsert({
        where: {
          accountId: validatorDetail.accountId.toString(),
        },
        create: {
          accountId: validatorDetail.accountId.toString(),
          ...identityRaw,
        },
        update: {
          ...identityRaw,
        },
      });

      const validatorRaw = {
        accountId: validatorDetail.accountId.toString(),
        identityId: identity.id,
        stashId: validatorDetail2.stashId.toString(),
        balance: convertBalance(validatorDetail.freeBalance),
        freeBalance:
          convertBalance(validatorDetail.freeBalance) -
          convertBalance(validatorDetail.frozenMisc),
        bonded: convertBalance(validatorDetail.frozenMisc),
        commission: Math.floor(
          validatorDetail2.validatorPrefs.commission.toNumber() / 10000000
        ),
      };

      const validatorDb = await this.prisma.validator.upsert({
        where: {
          accountId: validatorRaw.accountId,
        },
        create: {
          accountId: validatorRaw.accountId,
          stashId: validatorRaw.stashId,
          balance: validatorRaw.balance,
          freeBalance: validatorRaw.freeBalance,
          bonded: validatorRaw.bonded,
          commission: validatorRaw.commission,
          identityId: validatorRaw.identityId,
        },
        update: {
          balance: validatorRaw.balance,
          freeBalance: validatorRaw.freeBalance,
          bonded: validatorRaw.bonded,
          commission: validatorRaw.commission,
        },
      });

      // validator History
      let validatorHistory = await this.prisma.validatorHistory.findFirst({
        where: {
          id: validatorDb.id,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      const historyChanged = () => {
        if (validatorDb.commission !== validatorHistory.commission) {
          return true;
        }
        return false;
      };

      if (historyChanged && validatorDb.id) {
        validatorHistory = await this.prisma.validatorHistory.create({
          data: {
            validator: {
              connect: {
                id: validatorDb.id,
              },
            },
            commission: validatorDb.commission,
            bonded: validatorDb.bonded,
          },
        });
      }

      validatorsArr.push(validatorRaw);
    }

    await this.chainService.finishUpdateChain('VALIDATOR');

    return validatorsArr.splice(0, 10);
  }

  async getNominators() {
    await this.api.isReady;

    await this.chainService.startUpdateChain('NOMINATOR');

    const nominatorValidatorArr = [];
    const nominatorKeys = await this.api.query.staking.nominators.keys();
    const nominatorIds = nominatorKeys.map(
      ({ args: [nominatorId] }) => nominatorId
    );

    console.log('Go through nominators ...');

    for (let i = 0; i < nominatorIds.length; i++) {
      const nominator = await this.api.derive.balances.account(nominatorIds[i]);
      const nominator2 = await this.api.derive.staking.account(nominatorIds[i]);

      console.log(
        `-> Nominator ${nominator.accountId} bonded balance is ${convertBalance(
          nominator.frozenFee
        )} ${this.denom} number of Validators ${nominator2.nominators.length}`
      );

      const nominatorIdentity = await this.api.derive.accounts.info(
        nominatorIds[i]
      );
      const identityRaw = getIdentity(nominatorIdentity.identity);

      // upsert Identity Information
      const identity = await this.prisma.identity.upsert({
        where: {
          accountId: nominator.accountId.toString(),
        },
        create: {
          accountId: nominator.accountId.toString(),
          ...identityRaw,
        },
        update: {
          ...identityRaw,
        },
      });

      const nominatorRaw = {
        accountId: nominator.accountId.toString(),
        balance: convertBalance(nominator.freeBalance),
        freeBalance:
          convertBalance(nominator.freeBalance) -
          convertBalance(nominator.frozenFee),
        bonded: convertBalance(nominator.frozenFee),
        validators: nominator2.nominators,
        numberOfValidators: nominator2.nominators.length,
        identityId: identity.id,
      };

      nominatorValidatorArr.push(nominatorRaw);

      try {
        const newNominator = await this.prisma.nominator.upsert({
          where: {
            accountId: nominatorRaw.accountId,
          },
          create: {
            accountId: nominatorRaw.accountId,
            balance: nominatorRaw.balance,
            freeBalance: nominatorRaw.freeBalance,
            bonded: nominatorRaw.bonded,
            identityId: nominatorRaw.identityId,
          },
          update: {
            balance: nominatorRaw.balance,
            freeBalance: nominatorRaw.freeBalance,
            bonded: nominatorRaw.bonded,
            identityId: nominatorRaw.identityId,
          },
        });

        // delete all Validators/nominator for this nominator
        await this.prisma.validatorsNominators.deleteMany({
          where: {
            nominatorId: newNominator.id,
          },
        });

        // sound strange but is true
        for (let validator of nominator2.nominators) {
          const validatorDb = await this.prisma.validator.findFirst({
            where: {
              accountId: validator.toString(),
            },
          });

          if (validatorDb && newNominator) {
            await this.prisma.validatorsNominators.upsert({
              where: {
                validatorId_nominatorId: {
                  validatorId: validatorDb.id,
                  nominatorId: newNominator.id,
                },
              },
              create: {
                validatorId: validatorDb.id,
                nominatorId: newNominator.id,
              },
              update: {
                validatorId: validatorDb.id,
                nominatorId: newNominator.id,
              },
            });
          }
        }

        // now we have to remove nominators which are nominated other validator
        const nominatorValidatorsDb = await this.prisma.validatorsNominators.findMany(
          {
            where: {
              nominator: {
                id: newNominator.id,
              },
            },
            include: {
              validator: true,
            },
          }
        );
      } catch (e) {
        console.log(`Error in creating: ${e.message}`);
      }
    }

    await this.chainService.finishUpdateChain('NOMINATOR');

    // for testing purpose only
    return nominatorValidatorArr.splice(0, 10);
  }

  async getAccounts() {
    await this.api.isReady;

    await this.chainService.startUpdateChain('ACCOUNT');

    const accountArr = [];
    const accountKeys = await this.api.query.system.account.keys();
    const accountsIds = accountKeys.map(({ args: [accountId] }) => accountId);

    console.log(`Go through ${accountsIds.length} accounts ...`);

    for (let i = 0; i < accountsIds.length; i++) {
      const account = await this.api.derive.balances.account(accountsIds[i]);

      console.log(
        `-> ${i}-account ${account.accountId} total balance is ${convertBalance(
          account.freeBalance
        )} ${this.denom}`
      );

      const nominator = await this.prisma.nominator.findUnique({
        where: { accountId: account.accountId.toString() },
      });
      const isNominator = Boolean(nominator);

      const validator = await this.prisma.validator.findUnique({
        where: { accountId: account.accountId.toString() },
      });
      const isValidator = Boolean(validator);

      const accountIdentity = await this.api.derive.accounts.info(
        accountsIds[i]
      );
      const identityRaw = getIdentity(accountIdentity.identity);

      // upsert Identity Information
      const identity = await this.prisma.identity.upsert({
        where: {
          accountId: account.accountId.toString(),
        },
        create: {
          accountId: account.accountId.toString(),
          ...identityRaw,
        },
        update: {
          ...identityRaw,
        },
      });

      const accountRaw: Prisma.AccountCreateInput = {
        accountId: account.accountId.toString(),
        balance: convertBalance(account.freeBalance),
        freeBalance:
          convertBalance(account.freeBalance) -
          convertBalance(account.frozenFee),
        bonded: convertBalance(account.frozenFee),
        isNominator,
        isValidator,
        ...(validator && {
          validator: {
            connect: {
              id: validator.id,
            },
          },
        }),
        ...(nominator && {
          nominator: {
            connect: {
              id: nominator.id,
            },
          },
        }),
        identity: {
          connect: {
            id: identity.id,
          },
        },
      };

      accountArr.push(accountRaw);

      try {
        const newAccount = await this.prisma.account.upsert({
          where: {
            accountId: accountRaw.accountId,
          },
          create: {
            accountId: accountRaw.accountId,
            balance: accountRaw.balance,
            freeBalance: accountRaw.freeBalance,
            bonded: accountRaw.bonded,
            isNominator: accountRaw.isNominator,
            nominator: accountRaw.nominator,
            isValidator: accountRaw.isValidator,
            validator: accountRaw.validator,
            identity: accountRaw.identity,
          },
          update: {
            balance: accountRaw.balance,
            freeBalance: accountRaw.freeBalance,
            bonded: accountRaw.bonded,
            isNominator: accountRaw.isNominator,
            nominator: accountRaw.nominator,
            isValidator: accountRaw.isValidator,
            validator: accountRaw.validator,
            identity: accountRaw.identity,
          },
        });
      } catch (e) {
        console.log(`Error in creating: ${e.message}`);
      }
    }

    await this.chainService.finishUpdateChain('ACCOUNT');

    // for testing purpose only
    return accountArr.splice(0, 10);
  }

  async grabStakingData(direction: Direction, grabbers = 'all') {
    if (grabbers === 'blocks') {
      startGrabber('blockGrabber', this.api, this.prisma, direction);
      return;
    }
    if (grabbers !== 'all') {
      startGrabber('eraGrabber', this.api, this.prisma, direction);
      startGrabber('payoutsGrabber', this.api, this.prisma, direction);
      return;
    }
    startGrabber('eraGrabber', this.api, this.prisma, direction);
    startGrabber('payoutsGrabber', this.api, this.prisma, direction);
    startGrabber('blockGrabber', this.api, this.prisma, direction);
  }

  async getStakingStatus() {
    await this.api.isReady;
    const progress = await this.api.derive.session.progress();

    const totalStakeBalance = await this.api.query.staking.erasTotalStake(
      progress.currentEra.toNumber()
    );
    const totalStake = totalStakeBalance.toHuman();

    const totalIssuanceBalance = await this.api.query.balances.totalIssuance();
    const totalIssuance = totalIssuanceBalance.toHuman();

    const lastSavedEra = await this.prisma.era.findFirst({
      orderBy: {
        index: 'desc',
      },
    });

    return {
      activeEra: progress.activeEra.toNumber(),
      activeEraStart: progress.activeEraStart,
      currentEra: progress.currentEra.toNumber(),
      lastSavedEra,
      currentIndex: progress.currentIndex.toNumber(),
      validatorCount: progress.validatorCount.toNumber(),
      eraLength: progress.eraLength.toNumber(),
      isEpoch: true,
      sessionLength: progress.sessionLength.toNumber(),
      sessionsPerEra: progress.sessionsPerEra.toNumber(),
      eraProgress: progress.eraProgress.toNumber(),
      sessionProgress: progress.sessionProgress.toNumber(),
      totalStake,
      totalIssuance,
    };
  }

  async deleteData() {
    // TODO - make parametr what to delete
    await this.prisma.validatorsNominators.deleteMany({});
    await this.prisma.validatorHistory.deleteMany({});
    await this.prisma.validator.deleteMany({});
    await this.prisma.nominator.deleteMany({});
    await this.prisma.account.deleteMany({});
  }

  async validatorsPrefForLastEra(eraNumber?: number) {
    await this.api.isReady;
    const badValidators = [];
    const progress = await this.api.derive.session.progress();

    const lastEraNr = Math.max(
      progress.currentEra.toNumber(),
      progress.activeEra.toNumber()
    );
    const targets = await this.api.query.session.queuedKeys();
    for (const target of targets) {
      const validatorAddress = target[0];
      const pref = await this.api.query.staking.erasValidatorPrefs(
        lastEraNr,
        validatorAddress
      );
      const commission = pref.commission.toNumber() / 10000000;
      if (commission > 10 && !pref.blocked.isTrue) {
        const validatorIdentity = await this.api.derive.accounts.info(
          validatorAddress
        );
        const identity = getIdentity(validatorIdentity.identity);
        badValidators.push({
          validatorAddress,
          identity,
          commission,
        });
      }
    }

    return {
      id: lastEraNr,
      eraIndex: lastEraNr,
      badValidators,
    };
  }
}
