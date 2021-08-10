import { WsProvider } from '@polkadot/rpc-provider/ws';
import { ApiPromise } from '@polkadot/api';
import { chainTypes } from '../../chain-types';

//const endpoint = 'ws://167.99.75.151:9944';  // Gen1
const endpoint = 'wss://archive.snakenet.hydradx.io'; // Gen3

const main = async () => {
  try {
    const wsProvider = new WsProvider(endpoint);
    const providerOptions = {
      provider: wsProvider,
      types: chainTypes,
    };

    let api = await ApiPromise.create(providerOptions);
    await api.isReady;
    console.log(`API Ready for endpoint ${endpoint}`);
  } catch (e) {
    console.log(e);
  }
};

export default main;
