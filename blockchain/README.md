# Blockchain

This folder contains the ledger anchoring and portable trust-score verification service for AIRA.

## Stack

- Solidity (optional smart contract layer)
- Node.js or Python integration
- EVM-compatible chain or local ledger prototype

## Contract

`contracts/ScoreAnchor.sol` exposes:

```solidity
anchorScore(bytes32 scoreHash, address user, uint256 timestamp)
```

Only the hash, borrower address, timestamp, and anchoring wallet are stored. Raw features and score explanations never go on-chain.

## Local demo

```powershell
npm install
npx hardhat node
npm run deploy:local
npm test
```

The deploy command prints `ANCHOR_CONTRACT_ADDRESS`. Configure the backend with that address, the local RPC URL, and the deployer private key:

```text
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=<Hardhat account private key>
ANCHOR_CONTRACT_ADDRESS=<deployed contract address>
```

For a Polygon Amoy demo, use the Amoy RPC URL, a funded testnet private key, and the deployed contract address instead. The deployer wallet becomes the contract owner; only that backend wallet can anchor scores.

The backend derives a deterministic pseudonymous EVM address for each borrower from the backend secret and borrower ID. Borrowers do not need wallets. Score hashes and anchor metadata are stored in PostgreSQL, while raw features and explanations stay off-chain.

After deployment, set these values in `backend/.env`:

```text
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology
BLOCKCHAIN_CHAIN_ID=80002
BLOCKCHAIN_EXPLORER_URL=https://amoy.polygonscan.com
BLOCKCHAIN_PRIVATE_KEY=<the deployer private key>
ANCHOR_CONTRACT_ADDRESS=<the deployed ScoreAnchor address>
```

The lender API exposes `GET /lender/score/:userId/blockchain` for applicants connected to that lender. It verifies the stored score hash against the contract and returns the explorer link.
