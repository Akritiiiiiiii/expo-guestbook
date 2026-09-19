# Expo guestbook

A Solidity guestbook on the Sepolia test network, with a static front-end for visitors.
No framework and no dependencies. Vercel serves the `public/` folder.

```
public/            the website (index.html, app.js, style.css, config.js)
contracts/         Guestbook.sol (paste into Remix)
build-config.mjs   turns Vercel env vars into config at build time
vercel.json        output folder, security headers
```

## 1. Deploy the contract (Remix)

1. Get free Sepolia test ETH into MetaMask from any Sepolia faucet.
2. Open https://remix.ethereum.org and create `Guestbook.sol` with the contents of `contracts/Guestbook.sol`.
3. Solidity Compiler tab: pick 0.8.20 or newer, click Compile.
4. Deploy & Run tab: Environment = "Injected Provider - MetaMask" (MetaMask must be on Sepolia), click Deploy, confirm.
5. Copy the address under Deployed Contracts.

## 2. Deploy the site (Vercel)

**Option A: GitHub**
1. Push this folder to a GitHub repo.
2. In Vercel: Add New > Project > import the repo. Leave the framework as "Other". `vercel.json` sets the rest.
3. Before deploying, open Environment Variables and add `CONTRACT_ADDRESS` = your address.
4. Deploy.

**Option B: CLI**
```
npm i -g vercel
vercel                                   # first run links the project
vercel env add CONTRACT_ADDRESS          # paste the address, select all environments
vercel --prod
```

**Changed the address later?** Update `CONTRACT_ADDRESS` in Project Settings > Environment Variables, then Redeploy.
Environment variables are read at build time, so a redeploy is required.

You can also skip env vars and put the address in `public/config.js`, or open the site with `?contract=0xYourAddress`.

## Environment variables (all optional except CONTRACT_ADDRESS)

| Variable           | Default                                        | Purpose                          |
|--------------------|------------------------------------------------|----------------------------------|
| `CONTRACT_ADDRESS` | (none)                                         | Your deployed Guestbook          |
| `CHAIN_ID`         | `11155111`                                     | Sepolia                          |
| `CHAIN_NAME`       | `Sepolia`                                      | Shown in the UI and wallet       |
| `RPC_URL`          | `https://ethereum-sepolia-rpc.publicnode.com`  | Read-only access for the wall    |
| `EXPLORER_URL`     | `https://sepolia.etherscan.io`                 | Links to transactions/addresses  |
| `FAUCET_NOTE`      | "Ask the booth host for test ETH..."           | Shown when a wallet has no funds |

The build fails with a clear message if `CONTRACT_ADDRESS` or `CHAIN_ID` is malformed.

### Using a different test network (example: Base Sepolia)
Deploy the contract to that network in Remix, then set:
`CHAIN_ID=84532`, `CHAIN_NAME=Base Sepolia`, `RPC_URL=https://sepolia.base.org`, `EXPLORER_URL=https://sepolia.basescan.org`.
Double-check these values against the network's official docs before the event.

## 3. Test before the expo

- [ ] Open the Vercel URL on a laptop. The wall loads (empty is fine).
- [ ] Sign once from the laptop with MetaMask. Watch the pending block resolve into an entry.
- [ ] Open the URL on a phone in MetaMask's in-app browser and sign again.
- [ ] Open the URL in a normal phone browser: it should show the wall and offer the "Open inside MetaMask" link when signing.
- [ ] Make a QR code for your Vercel URL and scan it.

## Expo tips

- **Kiosk mode:** keep a funded MetaMask on the booth laptop. Visitors type; you approve. No visitor needs a wallet.
- **Second screen:** leave the page open on a monitor. It refreshes every 10 seconds, so new signatures appear live.
- **Rate limits:** the free public RPC can throttle under load. Set `RPC_URL` to a free Alchemy or Infura Sepolia endpoint if reads stall.
- **Internet required:** the page loads ethers.js from cdnjs and fonts from Google Fonts.

## Run locally

```
npm run dev        # serves public/ on http://localhost:3000
```
Put your address in `public/config.js`, or open `http://localhost:3000/?contract=0x...`.

## Security notes

- `vercel.json` sends a strict Content-Security-Policy. Scripts may only come from this site and cdnjs.cloudflare.com.
  If you add another script host or inline scripts, update the policy or the browser will block them.
- `connect-src https:` lets you swap in any HTTPS RPC provider.
- Visitor messages are rendered as plain text, never as HTML.
- The contract has no owner, no admin functions and no way to edit or remove entries.
