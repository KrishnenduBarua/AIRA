const { ethers } = require("ethers");
const crypto = require("crypto");
const {
  blockchainRpcUrl,
  blockchainPrivateKey,
  anchorContractAddress,
  blockchainChainId,
  blockchainExplorerUrl,
} = require("../config");

const ANCHOR_ABI = [
  "function anchorScore(bytes32 scoreHash, address user, uint256 timestamp)",
  "function anchors(bytes32) view returns (address user, uint256 timestamp, address anchoredBy, bool exists)",
  "function owner() view returns (address)",
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

function derivePseudonymousAddress(userId) {
  if (!blockchainPrivateKey || !userId) return null;
  const digest = crypto
    .createHmac("sha256", blockchainPrivateKey)
    .update(`aira:borrower:${userId}`)
    .digest("hex");
  return ethers.getAddress(`0x${digest.slice(-40)}`);
}

async function anchorScore(scoreData) {
  const scoreHash = buildScoreHash(scoreData);
  const userAddress = derivePseudonymousAddress(scoreData.userId);

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
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== blockchainChainId) {
      return {
        status: "wrong_network",
        scoreHash,
        chainId: Number(network.chainId),
        expectedChainId: blockchainChainId,
        message: `Connected to chain ${network.chainId}; expected ${blockchainChainId}.`,
      };
    }
    const timestamp = Math.floor(
      new Date(scoreData.timestamp).getTime() / 1000,
    );
    const owner = await contract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      return {
        status: "wrong_anchor_wallet",
        scoreHash,
        message: "The configured backend wallet is not the contract owner.",
      };
    }

    const transaction = await contract.anchorScore(
      scoreHash,
      userAddress,
      timestamp,
    );
    const receipt = await transaction.wait();

    return {
      status: "confirmed",
      scoreHash,
      transactionHash: transaction.hash,
      userAddress,
      timestamp,
      anchoredAt: new Date().toISOString(),
      network: `chain-${network.chainId}`,
      chainId: Number(network.chainId),
      blockNumber: receipt.blockNumber,
      contractAddress: anchorContractAddress,
      explorerUrl: `${blockchainExplorerUrl}/tx/${transaction.hash}`,
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

async function verifyScoreAnchor(scoreHash) {
  if (!blockchainRpcUrl || !anchorContractAddress) {
    return { status: "not_configured", scoreHash };
  }
  if (!ethers.isHexString(scoreHash, 32)) {
    return { status: "invalid_hash", scoreHash };
  }

  try {
    const provider = new ethers.JsonRpcProvider(blockchainRpcUrl);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== blockchainChainId) {
      return {
        status: "wrong_network",
        scoreHash,
        chainId: Number(network.chainId),
        expectedChainId: blockchainChainId,
      };
    }
    const contract = new ethers.Contract(
      anchorContractAddress,
      ANCHOR_ABI,
      provider,
    );
    const anchor = await contract.anchors(scoreHash);
    const exists = Boolean(anchor.exists);
    return {
      status: exists ? "verified" : "not_found",
      scoreHash,
      exists,
      userAddress: exists ? anchor.user : null,
      timestamp: exists ? Number(anchor.timestamp) : null,
      anchoredBy: exists ? anchor.anchoredBy : null,
      chainId: Number(network.chainId),
      network: `chain-${network.chainId}`,
      contractAddress: anchorContractAddress,
      explorerUrl: exists
        ? `${blockchainExplorerUrl}/address/${anchorContractAddress}#readContract`
        : null,
    };
  } catch (error) {
    return { status: "failed", scoreHash, message: error.message };
  }
}

module.exports = {
  anchorScore,
  buildScoreHash,
  derivePseudonymousAddress,
  verifyScoreAnchor,
};
