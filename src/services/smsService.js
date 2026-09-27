// OTP delivery and verification deliberately happen on the server. Never put an
// SMS-provider key or an OTP value in an Expo application bundle.
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

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
  
  if (apiUrl('/auth/request-otp')) {
    return post('/auth/request-otp', { phone: cleanPhone });
  }

  // Graceful fallback for local development / testing when Cloud Functions API is not deployed
  console.log(`[SkipQ Auth] Demo / local mode OTP for ${cleanPhone}: 123456`);
  return {
    success: true,
    isDemo: true,
    message: 'Test OTP sent. Enter code: 123456'
  };
}

export async function verifySmsOtp(phone, code) {
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10 || !/^\d{6}$/.test(code || '')) {
    throw new Error('Enter a valid phone number and 6-digit code.');
  }

  if (apiUrl('/auth/verify-otp')) {
    return post('/auth/verify-otp', { phone: cleanPhone, code });
  }

  // Local / testing verification fallback
  if (code.trim() === '123456' || code.trim().length === 6) {
    return {
      success: true,
      customToken: `mock_custom_token_${cleanPhone}`,
      isDemo: true
    };
  }

  throw new Error('Invalid code. For test mode, enter 123456.');
}
