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
  llmBaseUrl: process.env.LLM_BASE_URL || null,
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || null,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || null,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
  twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  otpLength: Number(process.env.OTP_LENGTH || 6),
};
