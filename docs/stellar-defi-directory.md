# DeFi on Stellar: a directory

> Written by Claude and researched with [Raven](https://raven.stellar.org),
> the Stellar docs and ecosystem MCP server. It isn't financial advice, and
> it isn't reviewed by any of the projects listed.
>
> Rechecked 2026-09-24 against testnet and mainnet: the contract IDs and Blend
> statuses held. The testnet Soroswap pair count had grown to 264. CLI recipes
> that ran on testnet are in [testnet-defi-cli.md](testnet-defi-cli.md).

What you can do with money on Stellar, who offers it, and how to check any of it yourself. Ten services, grouped into four things: lending, trading pools, vaults, and bonds. Every source below is a public API or a public contract call, so nothing here needs a wallet connection or a third-party tracker.

TVL, APY, and pool counts change constantly, so every number here is dated.

## What each one is for, in plain English

**Lending (Blend, K2 Lend, Templar).** Closest to a savings account. You deposit a token, other people borrow it, and you earn the interest they pay. The rate is not fixed: it rises when lots of people want to borrow and falls when they do not. You can also go the other way and borrow against what you deposited, which is what people do when they want cash without selling their holdings. The catch on the borrowing side is that if your collateral falls far enough in value, the protocol sells it to repay the loan. Blend and K2 Lend both run entirely on Stellar; Templar is the same idea stretched across chains, where your Stellar assets back a loan that is actually bookkept on NEAR.

**Trading pools (Aquarius, Soroswap, SushiSwap V3).** You supply two tokens as inventory for other people to swap between, and you collect a cut of every trade. Aquarius adds AQUA token rewards on top for pools its holders vote to subsidize. Soroswap is the simplest version: deposit equal values of both tokens and leave it. SushiSwap V3 pays more per dollar because you pick the price range your money sits in, but it stops earning when the price leaves that range, so it needs checking on. The shared catch is that when one token moves a lot against the other, you end up holding more of the loser and less of the winner, and you can come out behind simply holding both.

**Vaults (Upshift, Sentora, Solv).** Deposit one token, let someone else run the strategy. Upshift gives you a share token that quietly grows in value as the strategy earns, with nothing to manage. Sentora pays a rate its curator publishes up front, paid out at the end of a fixed term, and withdrawing early forfeits what you accrued. Solv is for people who hold Bitcoin and want it earning on Stellar rather than sitting still. You are trusting whoever runs the strategy in all three cases.

**Bonds (Etherfuse).** Tokenized government debt, mostly Mexican CETES and US Treasuries. You hold the token and it accrues interest on its own, no pool or lockup involved. It is the most boring option here and the one whose yield comes from outside crypto entirely.

## The services

| Service | Category | What you can do | Where to look |
|---|---|---|---|
| Blend | Lending | Supply an asset to earn interest, or borrow against it. Pools are isolated, so trouble in one cannot spread, and a backstop layer takes the first loss | [mainnet.blend.capital](https://mainnet.blend.capital), [docs.blend.capital](https://docs.blend.capital) |
| K2 Lend | Lending | Same idea, Aave-V3 mechanics, by Kinetic. Five reserves as of 2026-09-21: USDC, XLM, PYUSD, SolvBTC, USDT0 | [app.k2lend.com](https://app.k2lend.com), [docs.k2lend.com](https://docs.k2lend.com) |
| Templar | Lending | Borrow against Stellar collateral in a market settled on NEAR, bridged via HOT Omni | [templarfi.org](https://templarfi.org) |
| Aquarius | AMM / DEX | Provide liquidity to the largest Stellar AMM, earn swap fees plus AQUA rewards on pools voters choose to subsidize | [aqua.network](https://aqua.network) |
| Soroswap | AMM / DEX | Provide 50/50 liquidity to classic constant-product pools, or swap with routing across Stellar DEXes | [soroswap.finance](https://soroswap.finance) |
| SushiSwap V3 | AMM / DEX | Provide concentrated liquidity in a price range you choose. Higher fees per dollar, needs active management | [sushi.com/stellar](https://www.sushi.com/stellar/explore/pools) |
| Upshift | Yield vault | Deposit USDC or XLM, hold a share token that appreciates as the strategy earns | [app.upshift.finance](https://app.upshift.finance) |
| Sentora | Yield vault | Deposit XLM, USDC, or PYUSD for a published reward rate, claimable at term end. Early withdrawal forfeits rewards | [stellardefihub.com/vaults](https://stellardefihub.com/vaults) |
| Solv | Yield / BTC | Bring Bitcoin to Stellar as SolvBTC, then lend it, LP it, or hold the yield-bearing xSolvBTC | [solv.finance](https://solv.finance), [docs.solv.finance](https://docs.solv.finance) |
| Etherfuse | RWA yield | Hold tokenized sovereign bonds (CETES, USTRY, EUROB, TESOURO, KTB) that accrue while you hold them | [etherfuse.com](https://etherfuse.com) |

## Checking it yourself

The contract IDs on this page were right on the dates given. Before using one on
mainnet, look it up again (Raven MCP at `https://raven.stellar.org/mcp` if
connected, the registry below, or the protocol's docs) and call it read-only
first.

Everything here is **mainnet** (the Public network). The three hosts that answer without a key:

```
https://soroban-rpc.mainnet.stellar.gateway.fm   # Soroban RPC, for contract reads
https://horizon.stellar.org                      # Horizon, for classic accounts and history
https://stellar.rgstry.xyz                       # contract registry, name to contract ID
```

The network passphrase for mainnet is `Public Global Stellar Network ; September 2015`. Testnet has the same shapes at `soroban-testnet.stellar.org`, `horizon-testnet.stellar.org`, and `testnet.rgstry.xyz`, with the passphrase `Test SDF Network ; September 2015`.

### What exists on testnet

Two of the ten, verified live on 2026-09-21. Contract IDs are network-specific, so none of the mainnet addresses in this document work there: calling the mainnet Soroswap factory against the testnet RPC fails with `Storage, MissingValue`.

| Protocol | Testnet contract | Checked |
|---|---|---|
| Soroswap factory | `CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY` | `all_pairs_length()` returns 259, more pairs than mainnet's 214 |
| Soroswap router | `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD` | `get_factory()` returns the factory above |
| Blend pool factory | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` | `is_pool()` true for the pool below |
| Blend backstop | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` | listed as `blend/backstop-v2` |
| Blend testnet pool | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` | `get_config()` status 0, fully active, with a live reserve list |
| Blend CETES pool | `CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW` | `get_config()` status 0 |

Testnet is the better place to exercise Blend, not the worse one. Both testnet pools report status 0, fully active, while every mainnet pool was On Ice or Frozen that day, so supply and borrow flows are only testable here.

The testnet registry also carries DeFindex (a factory plus USDC, XLM, and CETES vaults) and a testnet USDC Stellar Asset Contract at `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`, which is what you would fund a test position with.

The other eight have nothing there. The testnet registry holds 42 contracts in 6 channels against mainnet's 215 in 59, with no entry for K2 Lend, Aquarius, SushiSwap, Upshift, Sentora, Solv, Etherfuse, or Templar. Upshift is the clearest case: its API exposes no testnet chain at all, and the staging vaults it does run (`Stellar PYUSD Staging`, `GamiTestUSDC`) sit on mainnet beside the real ones.

### Look up contract IDs instead of trusting a list

[stellar.rgstry.xyz](https://stellar.rgstry.xyz/contracts) is a registry of deployed Soroban contracts, organized into a channel per project. It has a JSON API that documents itself at `/api/v1`:

```
curl -s https://stellar.rgstry.xyz/api/v1/contracts                      # all deployments
curl -s https://stellar.rgstry.xyz/api/v1/contracts/soroswap/factory     # one contract, with WASM version history
curl -s https://stellar.rgstry.xyz/api/v1/contracts/blend/pool-factory-v2
```

The list endpoint returns `{"result": [...200 rows], "next": "<cursor>"}`, where each row's name is in `contract_name`; pass `next` back as `?cursor=<next>` for the rest. The second page holds the remaining 15 rows, none of them from these ten services. Every row carries the contract ID, the channel, and an `is_stellar_asset_contract` flag; `deployer` is filled in for 65 of the 215 rows and `wasm_name`/`wasm_version` for 86. The single-contract lookup returns those three as null but adds what matters more for checking an address: `created_at`, the deploying `transaction_hash`, and a `versions[]` history with each WASM hash, which is empty for Stellar Asset Contracts since they run the built-in token implementation.

Channels include `blend`, `soroswap`, `aquarius`, `etherfuse`, `solvfinance`, `defindex`, `allbridge`, and `centrifuge`. A channel is not always named after its protocol, so list them before guessing one.

Five of the ten services appear in the registry, and only two of those usefully. Checked on 2026-09-21:

Two are registered as usable entry points. Blend has `blend/pool-factory-v2`, `blend/backstop-v2`, `blend/fixed-v2-pool`, `blend/cetes-pool`, and the BLND token. Soroswap has `soroswap/factory` and `soroswap/router`. Every one of those IDs matches the table below. Two naming traps: `blend/cetes-pool` is the pool this document calls Etherfuse V2, and the registry holds only two of the five Blend pools. YieldBlox V2, Orbit V2, and Forex V2 are not registered, so their IDs can only be checked by calling them.

Three are registered only as tokens, not as protocols. Aquarius appears as the AQUA token alone, with no AMM or router contract. Etherfuse has all five bonds (`etherfuse/cetes`, `eurob`, `ktb`, `tesouro`, `ustry`), matching the five tickers in the table above, plus a `defindex/cetes-vault`. Solv has `solvfinance/solvbtc` and `solvfinance/xsolvbtc`; note the channel is `solvfinance`, not `solv`, and `/contracts/solv/solvbtc` returns not found. Knowing a token's address does not tell you where to deposit, so for these three you still need the protocol's own docs.

Five are absent: K2 Lend, SushiSwap V3, Upshift, Sentora, and Templar. Direct lookups like `/api/v1/contracts/k2/router` and `/api/v1/contracts/sushiswap/factory` return `Contract not found`. Templar could not appear in any case: its Stellar side is custody addresses, and its markets API returns NEAR deployment slugs with no Stellar address at all, which makes it the one row here with no on-chain verification path.

Two quirks: `limit` is capped at 200 with `offset` and `page` silently ignored, so `cursor` is the only way to page, and the API answers `Too many requests` if you sweep it quickly.

### Public APIs

Three protocols publish their own data, no authentication:

```
curl -s 'https://amm-api.aqua.network/pools/?page=1&size=100'      # Aquarius pools, TVL, APY
curl -s 'https://api.upshift.finance/v1/tokenized_vaults'          # Upshift vaults (filter chain_type=stellar)
curl -s 'https://app.templarfi.org/api/markets'                    # Templar markets
```

Two gotchas in that data. Aquarius returns USD values as 7-decimal fixed point, so divide by 1e7 or every pool looks a million times too small. Upshift returns staging and test vaults alongside real ones, distinguished only by an `is_visible` flag: on 2026-09-21, 6 Stellar vaults were returned and 2 were real.

### On-chain entry points

Everything else is a read-only contract call. These addresses were each called successfully on mainnet on 2026-09-21:

| Protocol | Contract | Call |
|---|---|---|
| Soroswap router | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` | The swap entry point, registered as `soroswap/router`. `get_factory()` returns the factory above, which is the cheapest way to prove you have the right address |
| Blend pool factory | `CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU` | Emits an event per pool deployed, which is how new Blend markets are found; registered as `blend/pool-factory-v2`. `is_pool(address)` returns true for any pool it created |
| Soroswap factory | `CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2` | `all_pairs_length()`, then `all_pairs(i)` for each index, then `token_0`/`token_1`/`get_reserves` on each pair |
| SushiSwap V3 factory | `CD3KRKGDRVWPXVB3VXLUMQKMX6XZ6Q2H334IVZD4XXNAMKSRVQL5GLYF` | `get_pool(tokenA, tokenB, fee)` for fee tiers 100, 500, 3000, 10000. There is no list method, so pools are found by asking |
| K2 router | `CCTUJZLYFAW7ZNQD2SXMUZIHBUUJJICYRKWLZJ6SK6TGNAWNXOJIV6J7` | `get_reserves_list()`, then `get_reserve_data(asset)` per asset |
| Blend pools | Fixed Pool V2 `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`, YieldBlox V2 `CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS`, Orbit V2 `CAE7QVOMBLZ53CDRGK3UNRRHG5EZ5NQA7HHTFASEMYBWHG6MDFZTYHXC`, Forex V2 `CBYOBT7ZCCLQCBUYYIABZLSEGDPEUWXCUXQTZYOG3YBDR7U357D5ZIRF`, Etherfuse V2 `CDMAVJPFXPADND3YRL4BSM3AKZWCTFMX27GLLXCML3PD62HEQS5FPVAI` | `get_config()` for status, `get_reserve_list()` and `get_reserve(asset)` for supply, borrow, and rates |
| Sentora vaults | XLM `CA54LVHMAY7HGLMVPN4W72XJB4OGKVZBZX26FWN6JD4P3HJFWQUQEHJO`, USDC `CAHEWHOPPDBQYFMAOLDOXXGUX2BCR7EXP4CWYCRY3NEAJB35YPZMMJFF`, PYUSD `CAQRAXBU6G4AAX4BZ7R4WLB62TSVAQFS5ZXJDVXRLAU2NZ2ZTGU5QOYB` | No read method exists. Size a vault by checking the deposited token's `balance()` at the vault address |

Four of those recipes take a token address as an argument. The three that come up constantly: XLM `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`, USDC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` (registered as `circle/usdc`), PYUSD `CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2` (`paypal-usd/pyusd`). Every one is a Stellar Asset Contract, so `balance(address)` and `name()` both work on them.

Aquarius and Upshift publish their addresses only through their APIs. The Aquarius pools endpoint returns an `address` per pool, which answers `get_reserves()` and `get_tokens()`; the Upshift vaults endpoint returns an `address` per vault, which answers `total_assets()`.

A minimal query, using only the Stellar SDK against mainnet:

```js
// npm install @stellar/stellar-sdk
import { rpc, Contract, TransactionBuilder, Account, Networks, scValToNative } from "@stellar/stellar-sdk";

const server = new rpc.Server("https://soroban-rpc.mainnet.stellar.gateway.fm");
const account = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"); // dummy source
const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.PUBLIC })
  .addOperation(new Contract("CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2").call("all_pairs_length"))
  .setTimeout(30).build();

const sim = await server.simulateTransaction(tx);
console.log(Number(scValToNative(sim.result.retval))); // 214 on 2026-09-21
```

`Networks.PUBLIC` is what makes this mainnet; swapping it for `Networks.TESTNET` and the testnet RPC host is the only change. Simulation is read-only either way: it never submits a transaction, costs a fee, or touches a wallet.

For classic Stellar rather than Soroban, Horizon serves balances and history directly at `https://horizon.stellar.org/accounts/{address}`. Contract source, deployment history, and WASM hashes are on [stellar.expert](https://stellar.expert/explorer/public).

## Two things worth knowing before you deposit

Blend pools carry a status that changes on its own. A pool flips to On Ice when 30% or more of its backstop deposits are queued for withdrawal, and to Frozen at 60%. On Ice disables borrowing, Frozen disables depositing too. `get_config()` returns it as a number: 0 and 1 are active, 2 and 3 are On Ice, 4 and 5 are Frozen, 6 is setup. On 2026-09-21 all five pools above returned 3, 3, 4, 5, and 4, so none of them were fully open. Check this before assuming a pool is live.

Published APYs are not all the same kind of number. Aquarius and Upshift report a yield they compute themselves. Blend and K2 publish an interest rate curve, and the APY is derived from current utilization, so it moves as people borrow and repay. Sentora's rate is set by a curator off-chain and quoted, not derived from anything on-chain. Sushi and Soroswap publish no APY at all, because fee income depends on trade volume that is not available on-chain.
