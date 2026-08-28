const { ethers } = require("ethers");
const {
  blockchainRpcUrl,
  blockchainPrivateKey,
  anchorContractAddress,
} = require("../config");

const ANCHOR_ABI = [
  "function anchorScore(bytes32 scoreHash, address user, uint256 timestamp)",
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function buildScoreHash(scoreData) {
  const canonicalPayload = JSON.stringify(canonicalize(scoreData));
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalPayload));
}

async function anchorScore(scoreData) {
  const scoreHash = buildScoreHash(scoreData);
  const userAddress = scoreData.userAddress;

  if (!blockchainRpcUrl || !blockchainPrivateKey || !anchorContractAddress) {
    return {
      status: "not_configured",
      scoreHash,
    };
  }

  if (!ethers.isAddress(userAddress)) {
    return {
      status: "missing_user_address",
      scoreHash,
      message: "A valid EVM userAddress is required for blockchain anchoring.",
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(blockchainRpcUrl);
    const wallet = new ethers.Wallet(blockchainPrivateKey, provider);
    const contract = new ethers.Contract(
      anchorContractAddress,
      ANCHOR_ABI,
      wallet,
    );
    const timestamp = Math.floor(
      new Date(scoreData.timestamp).getTime() / 1000,
    );
    const transaction = await contract.anchorScore(
      scoreHash,
      userAddress,
      timestamp,
    );

    return {
      status: "submitted",
      scoreHash,
      transactionHash: transaction.hash,
      userAddress,
      timestamp,
    };
  } catch (error) {
    console.error("Blockchain anchor error:", error.message);
    return {
      status: "failed",
      scoreHash,
      message: error.message,
    };
  }
}

module.exports = { anchorScore, buildScoreHash };
