import {
  findDefaultAsset,
  getDefaultAsset
} from "../../chunk-2G7L7YFT.mjs";

// src/exact/server/scheme.ts
import { convertToTokenAmount, parseMoney } from "@x402/core/utils";
var ExactStellarScheme = class {
  constructor() {
    this.scheme = "exact";
    this.defaultAssetTransferMethod = "default";
    this.paymentFlows = {
      default: { supported: ["authorization", "upfront"], default: "authorization" }
    };
    this.moneyParsers = [];
  }
  /**
   * Register a custom money parser in the parser chain.
   * Multiple parsers can be registered - they will be tried in registration order.
   * Each parser receives a decimal string (e.g., "1.50" for $1.50).
   * If a parser returns null, the next parser in the chain will be tried.
   * The default parser is always the final fallback.
   *
   * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
   * @returns The service instance for chaining
   */
  registerMoneyParser(parser) {
    this.moneyParsers.push(parser);
    return this;
  }
  /**
   * Decimals for a known default asset, or undefined.
   *
   * @param asset - Asset address or symbol
   * @param network - Target network
   * @returns Decimals when the asset is a known default; otherwise undefined
   */
  getAssetDecimals(asset, network) {
    return findDefaultAsset(asset, network)?.decimals;
  }
  /**
   * Parses a price into `AssetAmount`.
   * If price is already an `AssetAmount`, returns it directly.
   * If price is `Money` (string | number), parses to decimal and tries custom parsers.
   * If no custom parsers return a valid `AssetAmount`, falls back to default conversion, assuming USDC token contract.
   *
   * @param price - The `Price` to parse
   * @param network - The `Network` to use
   * @returns Promise that resolves to the parsed `AssetAmount`
   */
  async parsePrice(price, network) {
    if (typeof price === "object" && price !== null && "amount" in price) {
      if (!price.asset) {
        throw new Error(`Asset address must be specified for AssetAmount on network ${network}`);
      }
      return {
        amount: price.amount,
        asset: price.asset,
        extra: price.extra || {}
      };
    }
    const { amount, symbol } = parseMoney(price);
    for (const parser of this.moneyParsers) {
      const result = await parser(amount, network);
      if (result !== null) {
        return result;
      }
    }
    return this.defaultMoneyConversion(amount, network, symbol);
  }
  /**
   * Build payment requirements for this scheme/network combination
   *
   * @param paymentRequirements - The base payment requirements
   * @param supportedKind - The supported kind configuration
   * @param supportedKind.x402Version - The x402 protocol version
   * @param supportedKind.scheme - The payment scheme
   * @param supportedKind.network - The network identifier
   * @param supportedKind.extra - Extra metadata including `areFeesSponsored` from facilitator
   * @param extensionKeys - Extension keys supported by the facilitator
   * @returns Enhanced payment requirements with `areFeesSponsored` in extra
   */
  enhancePaymentRequirements(paymentRequirements, supportedKind, extensionKeys) {
    void extensionKeys;
    const areFeesSponsored = supportedKind.extra?.areFeesSponsored;
    return Promise.resolve({
      ...paymentRequirements,
      extra: {
        ...paymentRequirements.extra,
        ...typeof areFeesSponsored === "boolean" && { areFeesSponsored }
      }
    });
  }
  /**
   * Default money conversion implementation.
   * Converts decimal amount to USDC on the specified network.
   *
   * @param amount - The decimal amount (e.g., 1.50)
   * @param network - The network to use
   * @param symbol - Optional ticker from a suffixed price
   * @returns The parsed asset amount in USDC
   */
  defaultMoneyConversion(amount, network, symbol) {
    const assetInfo = getDefaultAsset(network, symbol);
    const tokenAmount = convertToTokenAmount(amount, assetInfo.decimals);
    return {
      amount: tokenAmount,
      asset: assetInfo.asset,
      extra: {}
    };
  }
};
export {
  ExactStellarScheme
};
//# sourceMappingURL=index.mjs.map