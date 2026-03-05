export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { mode, email, password, name } = await req.json();

  const endpoint = mode === 'signup'
    ? `${process.env.SUPABASE_URL}/auth/v1/signup`
    : `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`;

  const body = mode === 'signup'
    ? JSON.stringify({ email, password, data: { full_name: name } })
    : JSON.stringify({ email, password });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    },
    body
  });

  const data = await res.json();

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
