# Demo dry run (2026-09-24)

A rehearsal of tomorrow's video demo in a fresh cloud session. Testnet only. The
Privy wallet and `PRIVY_APP_SECRET` were not used. Times are UTC and come from
`date -u`. Wallet: `demo` = `GBSKN45LZS3ZRZ6FQ7S6ZE7PLWG5BJXA6EFBUJO2ABTWIBI3FGAQZGNF`.

## Timeline

| Beat | Start | End | Duration | Result | Transactions |
| --- | --- | --- | --- | --- | --- |
| 0 `/session-setup` | 03:58:42 | 04:12:43 | 14:01 | worked | none |
| 2 Rail402 listing (run during the build) | 03:59:20 | 03:59:32 | 0:12 | worked | none |
| 1 Wallet, fund, 5 USDC from the DEX | 04:12:48 | 04:13:09 | 0:21 | worked | [fund 899ecbd1…](https://stellar.expert/explorer/testnet/tx/899ecbd10473048b3caad9a6f4392b800653687478c497e5f25bbfdab44df2ec), [trustline 6e42422f…](https://stellar.expert/explorer/testnet/tx/6e42422fd588891713b8354fba6e1e42a7c014a7fe9fcae3c2e646bc4b52f9f5), [buy 9e4c6b7b…](https://stellar.expert/explorer/testnet/tx/9e4c6b7b08aadd36d06ecd07cbeaba9004d7efe524e9d682bd75a469113e8427) |
| 3 Fortune with `buy.mjs` | 04:13:14 | 04:13:23 | 0:09 | worked | [1c422005…](https://stellar.expert/explorer/testnet/tx/1c422005855c2205a3cefef27f25cc3f523c5eebaa6f7774770fd20630a249e7) |
| 4 Soroswap 10 XLM, Blend lend/withdraw 1 USDC | 04:13:37 | 04:14:23 | 0:46 | worked after retry | [swap da177660…](https://stellar.expert/explorer/testnet/tx/da177660dd06f62c03d4c6576ca212ca83bff504be910a8b0aa247fd1d0a9a52), [supply 494342fa…](https://stellar.expert/explorer/testnet/tx/494342fa2dc21ac282c5debf72b9062f8d0651543e89cf43872e910b50d1f608), [withdraw failed ef0bcb62…](https://stellar.expert/explorer/testnet/tx/ef0bcb624d89e32b8194d80693c98a58f3206e5d07127f46d4585f935bb7a02f), [withdraw 065bffe4…](https://stellar.expert/explorer/testnet/tx/065bffe4be80b7ec0d5a552eb6c71793ebf718e51bbb44bd97cef09e92849e53) |
| 5 "Could you use a mainnet wallet?" | 04:14:34 | 04:14:50 | 0:16 | answered | none |

**Total, session start to end of beat 5: 16:08.** The CLI build took 13:14 of
that ("Finished `release` profile … in 13m 14s", stellar-cli v28.0.0 `5acb4630`,
4 cores). Everything after the build took about 2 minutes. The times cover
command execution only. On camera, each beat also includes Claude's reply and
the YouTuber typing.

Amounts: 5 USDC cost 4.78 XLM on the DEX. On Soroswap, 10 XLM bought 1.0537513
USDC, matching the quote. Blend took 1 USDC and returned 0.9999999, a
1-stroop rounding loss.

## Errors, retries, and surprises

1. **Blend withdraw failed on-chain the first time.** It was the documented
   gotcha, and one retry worked:
   `VM call trapped with HostError … {"error":{"storage":"exceeded_limit"}}` /
   `trying to access contract data key outside of the footprint … {"symbol":"EmisData"},{"u32":3}` /
   `❌ error: transaction submission failed`. The withdraw was sent about 5 s
   after the supply.
2. **Classic transactions print no success line.** `tx new change-trust` and
   `path-payment-strict-receive` print only `ℹ️  Signing transaction: <hash>`.
   Success had to be confirmed with `token balance`.
   `keys generate --fund` prints no hash, so the funding hash came from Horizon.
3. **`contract invoke` output is long.** The Soroswap swap printed many
   event lines, and `tail` hid the `Signing transaction` hash. The swap hash
   came from Horizon.
4. **Rail402 listing has no prices.** Getting each price takes one 402 request
   per seller. The top seller (`playground-api…/demo/convert`) answers a bare
   GET with `400` and no `payment-required` header, so its price couldn't be
   read.
5. **`buy.mjs` warns on camera** when run with `NODE_USE_ENV_PROXY=1`:
   `[UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental`. This environment
   did not set `NODE_USE_ENV_PROXY`, although HUMANS.md says to. A plain Node
   `fetch` of the seller still returned 402 without it, so it may not be
   needed.
6. **Setup reports the owner's Privy wallet.** `session-start.sh` printed
   `✓ Privy wallet: GDCS… (CLI identity privy-wallet)`, and after the build
   `keys ls` listed `privy-wallet`. That comes from the committed
   `wallet.json`, whether or not `PRIVY_APP_SECRET` is set. The YouTuber will
   see the repo owner's wallet as an identity they can't use.
7. No permission prompts were hit (auto mode). The `until … ; scripts/session-start.sh`
   background waiter from the session-setup command worked. It fired about
   25 s after the binary appeared (30 s poll).

## Docs: what was wrong or slow, and fixes

| Where | Problem | Suggested fix |
| --- | --- | --- |
| session-setup / HUMANS.md | A 13 to 14 minute build dominates the demo. Only beat 2 (and the beat 5 answer) can run without the CLI. | Start the session before recording, or install a released CLI binary if `main` isn't needed. At minimum, script the demo so beat 2 runs during the build. |
| `docs/testnet-defi-cli.md`, Gotchas | Says Horizon's `/accounts/<G>/transactions` hides failed transactions. With `?include_failed=true` it lists them. | Mention `include_failed=true`. |
| `docs/testnet-defi-cli.md`, Blend | The retry is documented, but a demo will hit the failure. | Wait a ledger (about 6 s) between Blend calls, or say "expect one retry". |
| `docs/testnet-defi-cli.md` | `$S` is `~/.stellar-main/bin/stellar`, but sessions have `stellar` on PATH. | Use `stellar`. |
| `scripts/session-start.sh` | Reports and registers the Privy wallet when `PRIVY_APP_SECRET` is unset. | When the secret is unset, print "wallet.json present (owner's wallet; needs PRIVY_APP_SECRET)" and skip `keys add privy-wallet`. |
| `scripts/session-start.sh` / HUMANS.md | `NODE_USE_ENV_PROXY` is unset and nothing reports it. | Report it in the script, or drop the requirement if Node reaches the proxy without it. |
| CLAUDE.md, Docs | Doesn't say how to get a transaction hash after a noisy `contract invoke`. | Add: `grep 'Signing transaction'`, or Horizon `/accounts/<G>/transactions?include_failed=true`. |
| `stellar skill` vs CLAUDE.md | The skill says `network use` / `keys use`; CLAUDE.md says not to. It was already known and caused no trouble. | None needed. |
