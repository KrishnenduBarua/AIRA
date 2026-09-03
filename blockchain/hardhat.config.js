require("@nomicfoundation/hardhat-ethers");
require("dotenv").config({ path: "../backend/.env" });

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    amoy: {
      url:
        process.env.POLYGON_AMOY_RPC_URL ||
        "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: process.env.BLOCKCHAIN_PRIVATE_KEY
        ? [process.env.BLOCKCHAIN_PRIVATE_KEY]
        : [],
    },
  },
};
