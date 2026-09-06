import { createHash } from 'node:crypto';

const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
const headers = {};
if (process.env.ACCESS_PASSWORD) {
  headers['X-Access-Token'] = createHash('sha256')
    .update(process.env.ACCESS_PASSWORD).digest('hex');
}
async function request(path, method = 'GET') {
  const response = await fetch(base + path, {
    method, headers, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

try {
  let state = await request('/api/sap/assets');
  if (!state.ready && !state.fetching) await request('/api/sap/assets/fetch', 'POST');
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastProgress = '';
  while (!state.ready) {
    if (Date.now() >= deadline) throw new Error('SAP 资源准备超时（10 分钟）');
    await new Promise(resolve => setTimeout(resolve, 3000));
    state = await request('/api/sap/assets');
    if (state.error) throw new Error(state.error);
    const progress = `${state.progress?.stage || 'waiting'} ${state.progress?.found?.length || 0}/4`;
    if (progress !== lastProgress) console.log(`SAP 资源：${progress}`);
    lastProgress = progress;
  }
  const cert = await fetch(base + '/api/sap/certificate', {
    headers, signal: AbortSignal.timeout(35_000),
  });
  if (!cert.ok) throw new Error(`SAP 证书接口：HTTP ${cert.status}`);
  const body = await cert.text();
  if (!body.includes('sign-sap-setup-cert') || !body.includes('<data>')) {
    throw new Error('SAP 证书接口没有返回预期的证书 plist');
  }
  console.log('SAP 四项资源哈希检查通过，苹果设置证书可访问。');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
