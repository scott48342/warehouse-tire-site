/**
 * FedEx OAuth2 Authentication
 * Handles token acquisition and caching
 */

interface FedExToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getFedExToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.token;
  }

  const apiKey = process.env.FEDEX_API_KEY;
  const secretKey = process.env.FEDEX_SECRET_KEY;
  const apiUrl = process.env.FEDEX_API_URL || 'https://apis.fedex.com';

  if (!apiKey || !secretKey) {
    throw new Error('FedEx API credentials not configured');
  }

  const response = await fetch(`${apiUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: secretKey,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('FedEx auth error:', error);
    throw new Error(`FedEx authentication failed: ${response.status}`);
  }

  const data: FedExToken = await response.json();

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}
