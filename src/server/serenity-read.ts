// Fixed destination, bounded GET, no redirects, no database or broker credentials.
export async function readSerenity(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const token = process.env.SERENITY_READ_TOKEN ?? '';
  if (token.length < 32) throw new Error('Serenity read connection is not configured.');
  try {
    const response = await fetcher(
      'https://serenity-dashboard-00h0.onrender.com/api/analyst/summary',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      },
    );
    if (!response.ok || !response.body) throw new Error('Unavailable');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 100_000) {
        await reader.cancel();
        throw new Error('Response exceeds limit');
      }
      chunks.push(part.value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result.schema !== 'serenity-analyst-1' || result.paper_trading !== true)
      throw new Error('Unexpected summary');
    return result;
  } catch {
    // Do not expose headers, provider bodies or configuration in model output.
    throw new Error('Serenity summary unavailable. Check connection settings and dashboard health; do not invent portfolio data.');
  }
}
