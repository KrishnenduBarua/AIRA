module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "aira-dev-secret",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:5001",
  passwordSalt: process.env.PASSWORD_SALT || "aira-salt",
  databaseUrl: process.env.DATABASE_URL || null,
  useInMemoryDb: process.env.USE_IN_MEMORY_DB !== "false",
  blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL || null,
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || null,
  anchorContractAddress: process.env.ANCHOR_CONTRACT_ADDRESS || null,
};
