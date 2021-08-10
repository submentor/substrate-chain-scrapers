export const chainTypes = {

}

export const chainTypesHydraDX = {
  Amount: 'i128',
  AmountOf: 'Amount',
  Address: 'AccountId',
  Fee: {
    numerator: 'u32',
    denominator: 'u32',
  },
  BalanceInfo: {
    amount: 'Balance',
    assetId: 'AssetId',
  },
  CurrencyId: 'AssetId',
  CurrencyIdOf: 'AssetId',
  Intention: {
    who: 'AccountId',
    asset_sell: 'AssetId',
    asset_buy: 'AssetId',
    amount: 'Balance',
    discount: 'bool',
    sell_or_buy: 'IntentionType',
  },
  IntentionId: 'u128',
  IntentionType: {
    _enum: ['SELL', 'BUY'],
  },
  PalletId: 'u128',
  LookupSource: 'AccountId',
  Price: 'Balance',
  Chain: {
    genesisHash: 'Vec<u8>',
    lastBlockHash: 'Vec<u8>',
  },
};
