const crypto = require("crypto");
const twilio = require("twilio");
const {
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  twilioMessagingServiceSid,
  otpLength,
  otpExpiryMinutes,
} = require("../config");

const otpStore = new Map();

function normalizePhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\s+/g, "");
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
  return true;
}

async function sendOtpSms(phone, otp) {
  const normalized = normalizePhone(phone);
  if (!twilioAccountSid || !twilioAuthToken) {
    console.warn(
      "Twilio not configured. OTP SMS not sent. Phone:",
      normalized,
      "OTP:",
      otp,
    );
    return { mocked: true, phone: normalized, otp };
  }

  const client = twilio(twilioAccountSid, twilioAuthToken);
  const options = {
    to: normalized,
    body: `Your AIRA verification code is ${otp}. It expires in ${otpExpiryMinutes} minutes.`,
  };

  if (twilioMessagingServiceSid) {
    options.messagingServiceSid = twilioMessagingServiceSid;
  } else if (twilioPhoneNumber) {
    options.from = twilioPhoneNumber;
  }

  const message = await client.messages.create(options);
  return { mocked: false, sid: message.sid, phone: normalized };
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
  getOtpRecord,
};
