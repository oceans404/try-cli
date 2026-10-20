// src/constants.ts
var STELLAR_PUBNET_CAIP2 = "stellar:pubnet";
var STELLAR_TESTNET_CAIP2 = "stellar:testnet";
var STELLAR_WILDCARD_CAIP2 = "stellar:*";
var DEFAULT_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
var DEFAULT_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
var DEFAULT_PUBNET_HORIZON_URL = "https://horizon.stellar.org";
var STELLAR_DESTINATION_ADDRESS_REGEX = /^(?:[GC][ABCD][A-Z2-7]{54}|M[ABCD][A-Z2-7]{67})$/;
var STELLAR_ASSET_ADDRESS_REGEX = /^(?:[C][ABCD][A-Z2-7]{54})$/;
var USDC_PUBNET_ADDRESS = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
var USDC_TESTNET_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
var STELLAR_NETWORK_TO_PASSPHRASE = /* @__PURE__ */ new Map([
  [STELLAR_PUBNET_CAIP2, "Public Global Stellar Network ; September 2015"],
  [STELLAR_TESTNET_CAIP2, "Test SDF Network ; September 2015"]
]);
var DEFAULT_TOKEN_DECIMALS = 7;

// src/defaultAssets.ts
var DEFAULT_ASSETS = {
  [STELLAR_PUBNET_CAIP2]: [
    { asset: USDC_PUBNET_ADDRESS, decimals: DEFAULT_TOKEN_DECIMALS, symbol: "USDC" }
  ],
  [STELLAR_TESTNET_CAIP2]: [
    { asset: USDC_TESTNET_ADDRESS, decimals: DEFAULT_TOKEN_DECIMALS, symbol: "USDC" }
  ]
};
var getDefaultAsset = (network, symbol) => {
  const assets = DEFAULT_ASSETS[network];
  if (!assets || assets.length === 0) {
    throw new Error(`No default asset configured for network ${network}`);
  }
  if (!symbol) {
    return assets[0];
  }
  const normalized = symbol.toUpperCase();
  const match = assets.find((entry) => entry.symbol.toUpperCase() === normalized);
  if (!match) {
    throw new Error(`No ${symbol} default asset configured for network ${network}`);
  }
  return match;
};
var findDefaultAsset = (asset, network) => {
  const assets = DEFAULT_ASSETS[network];
  if (!assets) {
    return void 0;
  }
  return assets.find((entry) => entry.asset === asset);
};

export {
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  STELLAR_WILDCARD_CAIP2,
  DEFAULT_TESTNET_RPC_URL,
  DEFAULT_TESTNET_HORIZON_URL,
  DEFAULT_PUBNET_HORIZON_URL,
  STELLAR_DESTINATION_ADDRESS_REGEX,
  STELLAR_ASSET_ADDRESS_REGEX,
  USDC_PUBNET_ADDRESS,
  USDC_TESTNET_ADDRESS,
  STELLAR_NETWORK_TO_PASSPHRASE,
  DEFAULT_TOKEN_DECIMALS,
  DEFAULT_ASSETS,
  getDefaultAsset,
  findDefaultAsset
};
//# sourceMappingURL=chunk-2G7L7YFT.mjs.map