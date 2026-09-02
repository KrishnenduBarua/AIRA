require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "aira-dev-secret",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://127.0.0.1:5001",
  passwordSalt: process.env.PASSWORD_SALT || "aira-salt",
  databaseUrl: process.env.DATABASE_URL || null,
  useInMemoryDb: process.env.USE_IN_MEMORY_DB !== "false",
  blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL || null,
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || null,
  anchorContractAddress: process.env.ANCHOR_CONTRACT_ADDRESS || null,
  llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || null,
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  llmModel: process.env.LLM_MODEL || "gpt-5.6-luna",
  textbeeApiKey: process.env.TEXTBEE_API_KEY || null,
  textbeeApiUrl:
    process.env.TEXTBEE_API_URL ||
    "https://api.textbee.dev/api/v1/gateway/send-sms",
  textbeeDeviceId: process.env.TEXTBEE_DEVICE_ID || null,
  textbeeSenderId: process.env.TEXTBEE_SENDER_ID || null,
  otpMode: (process.env.OTP_MODE || "live").toLowerCase(),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  otpLength: Number(process.env.OTP_LENGTH || 6),
};
