import { SchemeNetworkServer, MoneyParser, Network, Price, AssetAmount, PaymentRequirements } from '@x402/core/types';

/**
 * Stellar server implementation for the Exact payment scheme.
 */
declare class ExactStellarScheme implements SchemeNetworkServer {
    readonly scheme = "exact";
    readonly defaultAssetTransferMethod = "default";
    readonly paymentFlows: {
        readonly default: {
            readonly supported: readonly ["authorization", "upfront"];
            readonly default: "authorization";
        };
    };
    private moneyParsers;
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
    registerMoneyParser(parser: MoneyParser): ExactStellarScheme;
    /**
     * Decimals for a known default asset, or undefined.
     *
     * @param asset - Asset address or symbol
     * @param network - Target network
     * @returns Decimals when the asset is a known default; otherwise undefined
     */
    getAssetDecimals(asset: string, network: Network): number | undefined;
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
    parsePrice(price: Price, network: Network): Promise<AssetAmount>;
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
    enhancePaymentRequirements(paymentRequirements: PaymentRequirements, supportedKind: {
        x402Version: number;
        scheme: string;
        network: Network;
        extra?: Record<string, unknown>;
    }, extensionKeys: string[]): Promise<PaymentRequirements>;
    /**
     * Default money conversion implementation.
     * Converts decimal amount to USDC on the specified network.
     *
     * @param amount - The decimal amount (e.g., 1.50)
     * @param network - The network to use
     * @param symbol - Optional ticker from a suffixed price
     * @returns The parsed asset amount in USDC
     */
    private defaultMoneyConversion;
}

export { ExactStellarScheme };
