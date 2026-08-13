const base = 'http://localhost:5002/api/v1';

const req = async (method, url, body, token) => {
  const response = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
};

const main = async () => {
  const login = await req('POST', '/auth/login', { email: 'admin@restosphere.com', password: 'Admin@12345' });
  const token = login.json?.data?.accessToken;
  const list = await req('GET', '/admin/dashboard/recent-orders', null, token);
  const target = list.json?.data?.[0];
  if (!target) {
    console.log(JSON.stringify({ step: 'list', status: list.status }, null, 2));
    return;
  }

  const del = await req('DELETE', `/orders/${target.orderNumber}`, null, token);
  const after = await req('GET', '/admin/dashboard/recent-orders', null, token);
  const stillPresent = (after.json?.data || []).some((order) => order.orderNumber === target.orderNumber);

  console.log(JSON.stringify({
    target: target.orderNumber,
    deleteStatus: del.status,
    deleteMessage: del.json?.message,
    stillPresent,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
