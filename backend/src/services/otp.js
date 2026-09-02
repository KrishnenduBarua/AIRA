const axios = require("axios");
const {
  textbeeApiKey,
  textbeeApiUrl,
  textbeeDeviceId,
  otpMode,
  otpLength,
  otpExpiryMinutes,
} = require("../config");

const otpStore = new Map();
const verifiedPhoneStore = new Map();

function normalizePhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone)
    .replace(/[^\d+]/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return "";
  if (cleaned.startsWith("00")) {
    return `+${cleaned.slice(2)}`;
  }
  if (cleaned.startsWith("+88") || cleaned.startsWith("88")) {
    return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  }
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    return `+88${cleaned}`;
  }
  if (cleaned.startsWith("880") && !cleaned.startsWith("+")) {
    return `+${cleaned}`;
  }

  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function generateOtp() {
  const length = Number(otpLength) || 6;
  return String(
    Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)),
  )
    .padStart(length, "0")
    .slice(0, length);
}

function saveOtp(phone, otp) {
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + (Number(otpExpiryMinutes) || 5) * 60 * 1000,
    used: false,
  });
}

function getOtpRecord(phone) {
  const record = otpStore.get(phone);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return null;
  }
  return record;
}

function verifyOtp(phone, otp) {
  const record = getOtpRecord(phone);
  if (!record) return false;
  if (record.used) return false;
  if (record.otp !== String(otp)) return false;
  record.used = true;
  otpStore.delete(phone);
  verifiedPhoneStore.set(phone, {
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
  });
  return true;
}

function isPhoneVerified(phone) {
  const record = verifiedPhoneStore.get(phone);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    verifiedPhoneStore.delete(phone);
    return false;
  }
  return true;
}

function consumePhoneVerification(phone) {
  const result = isPhoneVerified(phone);
  verifiedPhoneStore.delete(phone);
  return result;
}

async function sendOtpSms(phone, otp) {
  const normalized = normalizePhone(phone);
  const isDemoMode = String(otpMode) === "demo" || !textbeeApiKey;

  if (isDemoMode) {
    console.warn(
      "OTP demo mode enabled. SMS is skipped and the code is returned for local frontend testing. Phone:",
      normalized,
      "OTP:",
      otp,
    );
    return { mocked: true, mode: "demo", phone: normalized, otp };
  }

  const payload = {
    deviceId: textbeeDeviceId,
    recipients: [normalized],
    message: `Your AIRA verification code is ${otp}. It expires in ${otpExpiryMinutes} minutes.`,
  };

  const response = await axios.post(
    textbeeApiUrl || "https://api.textbee.dev/api/v1/gateway/send-sms",
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": textbeeApiKey,
      },
    },
  );

  return {
    mocked: false,
    mode: "live",
    response: response.data,
    phone: normalized,
  };
}

async function createOtpForPhone(phone) {
  const normalized = normalizePhone(phone);
  const otp = generateOtp();
  saveOtp(normalized, otp);
  return sendOtpSms(normalized, otp);
}

module.exports = {
  createOtpForPhone,
  normalizePhone,
  verifyOtp,
  isPhoneVerified,
  consumePhoneVerification,
  getOtpRecord,
  generateOtp,
  saveOtp,
};
