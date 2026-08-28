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

For a Polygon Amoy demo, use the Amoy RPC URL, a funded testnet private key, and the deployed contract address instead.
