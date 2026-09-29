// OTP delivery and verification service
// Supports Cloud Functions API, direct Fast2SMS integration, and testing fallback
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const FAST2SMS_API_KEY = process.env.EXPO_PUBLIC_FAST2SMS_API_KEY || '';

// In-memory store for generated OTPs during the active session
const activeOtps = new Map();

function apiUrl(path) {
  if (!API_BASE_URL || API_BASE_URL.includes('YOUR_')) {
    return null;
  }
  return `${API_BASE_URL}${path}`;
}

async function post(path, body) {
  const url = apiUrl(path);
  if (!url) return null;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Could not complete secure sign-in.');
  return data;
}

export async function sendSmsOtp(phone) {
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) return { success: false, message: 'Invalid phone number format.' };

  // 1. Try Cloud Functions API if configured
  if (apiUrl('/auth/request-otp')) {
    try {
      const res = await post('/auth/request-otp', { phone: cleanPhone });
      if (res?.success) return { success: true, isDemo: false };
    } catch (e) {
      console.log('Cloud Functions OTP error, falling back:', e.message);
    }
  }

  // 2. Try direct Fast2SMS Gateway if API key is present
  if (FAST2SMS_API_KEY && !FAST2SMS_API_KEY.includes('YOUR_')) {
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    try {
      const smsRes = await fetch(
        `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(FAST2SMS_API_KEY)}&variables_values=${generatedOtp}&route=otp&numbers=${cleanPhone}`
      );
      const smsData = await smsRes.json().catch(() => ({}));

      if (smsRes.ok && smsData.return === true) {
        activeOtps.set(cleanPhone, {
          code: generatedOtp,
          expiresAt: Date.now() + 5 * 60 * 1000
        });
        console.log(`[Fast2SMS] Real OTP sent to +91 ${cleanPhone}`);
        return {
          success: true,
          isDemo: false,
          message: 'Verification code sent to your mobile phone via SMS.'
        };
      } else {
        console.log('[Fast2SMS] Provider status:', smsData.status_code, smsData.message);
      }
    } catch (err) {
      console.log('[Fast2SMS] Direct gateway call note:', err.message);
    }
  }

  // 3. Graceful fallback for local development / testing
  console.log(`[SkipQ Auth] Demo / local mode OTP for ${cleanPhone}: 123456`);
  return {
    success: true,
    isDemo: true,
    message: 'Demo / local mode active. Use code: 123456 (pre-filled for testing)'
  };
}

export async function verifySmsOtp(phone, code) {
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  const cleanCode = (code || '').trim();

  if (cleanPhone.length !== 10 || !/^\d{6}$/.test(cleanCode)) {
    throw new Error('Enter a valid phone number and 6-digit code.');
  }

  // 1. Try Cloud Functions API verification
  if (apiUrl('/auth/verify-otp')) {
    try {
      return await post('/auth/verify-otp', { phone: cleanPhone, code: cleanCode });
    } catch (e) {
      console.log('Cloud Functions verify note, checking local:', e.message);
    }
  }

  // 2. Check active in-memory OTP from direct Fast2SMS dispatch
  if (activeOtps.has(cleanPhone)) {
    const entry = activeOtps.get(cleanPhone);
    if (Date.now() > entry.expiresAt) {
      activeOtps.delete(cleanPhone);
      throw new Error('This verification code has expired. Please request a new one.');
    }
    if (entry.code === cleanCode) {
      activeOtps.delete(cleanPhone);
      return {
        success: true,
        customToken: `user_token_${cleanPhone}`,
        isDemo: false
      };
    }
  }

  // 3. Local / testing verification fallback (123456)
  if (cleanCode === '123456') {
    return {
      success: true,
      customToken: `mock_custom_token_${cleanPhone}`,
      isDemo: true
    };
  }

  throw new Error('Invalid code. Please enter the 6-digit code sent to your phone or 123456.');
}
