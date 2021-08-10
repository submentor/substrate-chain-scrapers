import { Config } from './config.interface';

const config: Config = {
  nest: {
    port: 4000,
  },
  chain: {
    name: 'polkadot',
    wsEndPoint: process.env.CHAIN,
    denom: 'DOT',
    decimalPlaces: 1000000000,
  },

};

export default (): Config => config;
