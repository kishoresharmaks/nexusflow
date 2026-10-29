import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js proxy route for Shopify OAuth callback.
 * Forwards authorization parameters (code, hmac, shop, state, timestamp)
 * from frontend port (3000) to the backend API (port 4000).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const backendBaseUrl =
    process.env['API_BASE_URL'] ||
    process.env['NEXT_PUBLIC_API_URL'] ||
    'http://localhost:4000/api/v1';

  const cleanBackendUrl = backendBaseUrl.replace(/\/+$/, '');
  const targetUrl = new URL(`${cleanBackendUrl}/integrations/stores/shopify/callback`);

  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(targetUrl.toString());
}
