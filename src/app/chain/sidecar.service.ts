import { Injectable, HttpService } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { ChainConfig } from 'src/configs/config.interface';

@Injectable()
export class SidecarService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  private sidecarAPI = 'http://sidecar:8080';
  private decimalPlaces: number;

  async onModuleInit() {
    const chainConfig = this.configService.get<ChainConfig>('chain');
    this.decimalPlaces = chainConfig.decimalPlaces;
  }

  async stakingProgressXXX(): Promise<Observable<AxiosResponse<String[]>>> {
    const response = await this.httpService
      .get(`${this.sidecarAPI}/pallets/staking/progress`)
      .toPromise();

    return response.data;
  }

  async stakingProgress() {
    let result;
    try {
      result = this.httpService
        .get(`${this.sidecarAPI}/pallets/staking/progress`)
        .toPromise()
        .then((res) => res.data)
        .catch((err) => {
          throw err;
        });
    } catch (e) {
      throw e;
    }
    return result;
  }

  async accountPayouts(accountId) {
    // transform payouts data for frontend
    const prepareData = (data) => {
      console.log(JSON.stringify(data, undefined, 2));
      let result = {};

      const calcSum = (data) => {
        if (!data || data.lenght === 0) {
          return 0;
        }

        return data.reduce(
          (total, curr) =>
            (total += curr.nominatorStakingPayout / this.decimalPlaces),
          0
        );
      };

      const payoutValidators = (data) => {
        if (!data || data.lenght === 0) {
          return [];
        }

        return data.reduce((result, curr) => {
          if (!result.includes(curr.validatorId)) {
            result.push(curr.validatorId);
          }
          return result;
        }, []);
      };

      const payouts = data.erasPayouts.map((item) => {
        let payout = {};
        if (item.payouts) {
          payout = {
            era: item.era,
            eraDate: 'N/A yet',
            totalPayout: calcSum(item.payouts),
            noOfPayouts: item.payouts.lenght,
            validators: payoutValidators(item.payouts),
          };
        }
        return payout;
      });

      const accountPayouts = {
        statistics: {},
        payouts,
      };

      result = {
        accountPayouts,
      };

      return result;
    };

    let sidecarResult;
    try {
      sidecarResult = this.httpService
        .get(
          `${this.sidecarAPI}/accounts/${accountId}/staking-payouts?depth=80&unclaimedOnly=false`
        )
        .toPromise()
        .then((res) => prepareData(res.data))
        .catch((err) => {
          throw err;
        });
    } catch (e) {
      throw e;
    }
    return sidecarResult;
  }
}
