# Yuin — Demo plan (ETHGlobal Tokyo)

Deck: 9 slides. 1 cover + Privy comparison, 2 how sign-in works, 3 inside the network, 4 app setup (ENS), 5 dashboard (Uniswap), 6 sake auction (World), 7 tic-tac-toe (mention), 8 run a node, 9 summary.

Prizes targeted: World IDKit, ENSv2, Uniswap. Classic "from scratch" track: fresh repo, commit small and often.

## 1. boilerplate + website dashboard (Uniswap)
Boilerplate app shows: integrate Yuin, stake, add recovery (World), MFA (passkey), tiered auth. Funds live in the user dashboard on the website.
Login: Google + passkey.
Live: copy the account address → fund it with Sepolia ETH from MetaMask → one-click swap ETH → USDC → view tx history → send an amount in token A while paying in token B (auto-convert or suggest). All via Universal Router.
Required: FEEDBACK.md + Uniswap feedback form; README points to the swap code.

## 2. auction-demo (World + ENS)
Login policy: Google + World Passport/NFC with age check. (Sake auction, prices in a JPY stablecoin, bids in USDC via Uniswap.)
Live: show the app's ENS records (policy says age check). User enters with World age verification and can view the auction.
Then change policy live in app setup: add World Selfie Check as step-up for `bid`. User returns: blocked from bidding until the selfie passes.
Required by World: explain why each credential is the minimum needed; show one failed path (no selfie → can't bid); WORLD_DEBRIEF.md (time to first success, friction, missing docs, top improvement).

## 3. game-demo (mention only)
Tic-tac-toe, 2 players. Email sign-up + passkey, mobile only, World selfie (humans only). Free play or play for tokens (lock in contract, winner paid). Not demoed live.

## Build order
1. Core: static sign-in page, 3 contracts, nodes + commander over GSOC, Google + passkey, smart account.
2. demos/boilerplate + website dashboard. 3. demos/auction. 4. demos/game only if time allows.
First test: Google OAuth redirect to the Swarm-served domain, and Sepolia USDC liquidity on Uniswap.
