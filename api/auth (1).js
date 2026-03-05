export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Check env vars are present
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL env var' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  if (!serviceKey)  return new Response(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_KEY env var' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON: ' + e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { mode, email, password, name } = body;

  if (!mode || !email || !password) {
    return new Response(JSON.stringify({ error: 'Missing mode, email, or password' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const endpoint = mode === 'signup'
    ? `${supabaseUrl}/auth/v1/signup`
    : `${supabaseUrl}/auth/v1/token?grant_type=password`;

  const payload = mode === 'signup'
    ? JSON.stringify({ email, password, data: { full_name: name } })
    : JSON.stringify({ email, password });

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: payload
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Fetch to Supabase failed: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
