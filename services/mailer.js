/**
 * RFT Entertainment — Email Service (Resend)
 * Resend is free up to 3,000 emails/month, no SMTP config needed.
 * Docs: https://resend.com/docs
 *
 * To enable: set RESEND_API_KEY in Railway environment variables.
 * Get a free key at: https://resend.com/signup
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'RFT Entertainment <noreply@rft-entertainment.com>';
const APP_NAME       = 'RFT Entertainment';

/**
 * Send OTP email for password reset
 * Returns { sent: true } on success, { sent: false, reason } on failure
 */
async function sendOtpEmail(toEmail, otp, userName) {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1a1a1a;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a1a,#0f0f0f);padding:32px;text-align:center;border-bottom:1px solid #2a2a2a">
          <h1 style="margin:0;color:#d4a843;font-size:22px;font-weight:800;letter-spacing:1px">${APP_NAME}</h1>
          <p style="margin:6px 0 0;color:#666;font-size:13px">Video Reward Platform</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px">
          <p style="color:#e8e8e8;font-size:15px;margin:0 0 8px">Hi ${userName || 'there'},</p>
          <p style="color:#999;font-size:14px;margin:0 0 28px;line-height:1.6">
            You requested a password reset for your RFT Entertainment account.<br>
            Use the code below — it expires in <strong style="color:#d4a843">15 minutes</strong>.
          </p>

          <!-- OTP Box -->
          <div style="background:#0f0f0f;border:2px solid #d4a843;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px">
            <p style="margin:0 0 8px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px">Your Reset Code</p>
            <p style="margin:0;color:#d4a843;font-size:40px;font-weight:900;letter-spacing:8px">${otp}</p>
          </div>

          <p style="color:#666;font-size:13px;margin:0 0 6px">⚠️ This code will expire in 15 minutes.</p>
          <p style="color:#666;font-size:13px;margin:0">If you did not request this, please ignore this email. Your account is safe.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center">
          <p style="margin:0;color:#444;font-size:12px">${APP_NAME} · Earn USDT watching videos</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [toEmail],
        subject: `${otp} — Your ${APP_NAME} Password Reset Code`,
        html
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error:', data);
      return { sent: false, reason: data.message || 'Email delivery failed' };
    }
    console.log('OTP email sent:', data.id, '→', toEmail);
    return { sent: true, id: data.id };
  } catch (err) {
    console.error('Mailer error:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendOtpEmail };
