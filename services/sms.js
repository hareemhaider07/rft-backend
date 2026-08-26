/**
 * RFT Entertainment — SMS Service (Twilio)
 * Pay-as-you-go, ~$0.0075 per SMS to Pakistan.
 * Docs: https://www.twilio.com/docs/sms
 *
 * To enable, set these in Railway environment variables:
 *   TWILIO_ACCOUNT_SID  — from twilio.com/console
 *   TWILIO_AUTH_TOKEN   — from twilio.com/console
 *   TWILIO_FROM_NUMBER  — your Twilio phone number e.g. +12015550123
 */

const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM   = process.env.TWILIO_FROM_NUMBER;
const APP_NAME      = 'RFT Entertainment';

/**
 * Normalize phone to E.164 format
 * Handles: 03001234567 → +923001234567
 *           923001234567 → +923001234567
 *          +923001234567 → +923001234567
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return '+' + digits;
  // Pakistan 03xx → +923xx
  if (digits.startsWith('0') && digits.length === 11) return '+92' + digits.slice(1);
  // Already has country code
  if (digits.length >= 11) return '+' + digits;
  return null;
}

/**
 * Send OTP via SMS using Twilio REST API (no SDK needed)
 * Returns { sent: true } on success, { sent: false, reason } on failure
 */
async function sendOtpSms(toPhone, otp) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { sent: false, reason: 'Twilio credentials not configured' };
  }

  const normalizedPhone = normalizePhone(toPhone);
  if (!normalizedPhone) {
    return { sent: false, reason: 'Invalid phone number format' };
  }

  const body = `[${APP_NAME}] Your password reset code is: ${otp}\n\nExpires in 15 minutes. Do not share this code.`;

  try {
    // Use Twilio REST API directly (no npm package needed)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const params = new URLSearchParams({
      From: TWILIO_FROM,
      To:   normalizedPhone,
      Body: body
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok || data.status === 'failed' || data.error_code) {
      console.error('Twilio error:', data.message || data.error_message);
      return { sent: false, reason: data.message || 'SMS delivery failed' };
    }
    console.log('OTP SMS sent:', data.sid, '→', normalizedPhone);
    return { sent: true, sid: data.sid };
  } catch (err) {
    console.error('SMS error:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendOtpSms, normalizePhone };
