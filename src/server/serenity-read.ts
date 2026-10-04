// Fixed destination, bounded GET, no redirects, no database or broker credentials.
export async function readSerenity(
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const token = process.env.SERENITY_READ_TOKEN ?? '';
  if (token.length < 32) throw new Error('Serenity read connection is not configured.');
  let diagnostic = 'SERENITY_NETWORK: connessione non riuscita';
  const timeout = AbortSignal.timeout(45_000);
  try {
    const response = await fetcher(
      'https://serenity-dashboard-00h0.onrender.com/api/analyst/summary',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.any([signal, timeout]),
      },
    );
    if (!response.ok) {
      const labels: Record<number, string> = {
        401: 'chiave non accettata; verificare stesso SERENITY_READ_TOKEN nei due servizi',
        403: 'accesso negato',
        404: 'endpoint non trovato; verificare deploy del dashboard',
        429: 'troppe richieste; riprovare piu tardi',
        500: 'errore interno dashboard; controllare i log',
        502: 'dashboard non disponibile o in riavvio',
        503: 'servizio non pronto o configurazione/dati non disponibili',
        504: 'tempo del gateway esaurito',
      };
      diagnostic = `SERENITY_HTTP_${response.status}: ${labels[response.status] ?? 'risposta HTTP non riuscita'}`;
      await response.body?.cancel();
      throw new Error('Unavailable');
    }
    if (!response.body) {
      diagnostic = 'SERENITY_EMPTY: risposta vuota';
      throw new Error('Unavailable');
    }
    diagnostic = 'SERENITY_READ: lettura risposta interrotta';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 100_000) {
        await reader.cancel();
        diagnostic = 'SERENITY_SIZE: riepilogo oltre il limite consentito';
        throw new Error('Response exceeds limit');
      }
      chunks.push(part.value);
    }
    diagnostic = 'SERENITY_FORMAT: risposta JSON non valida';
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    diagnostic = 'SERENITY_SCHEMA: versione o formato riepilogo non riconosciuto';
    if (result.schema !== 'serenity-analyst-1' || result.paper_trading !== true)
      throw new Error('Unexpected summary');
    return result;
  } catch {
    // Do not expose headers, provider bodies or configuration in model output.
    if (signal.aborted) diagnostic = 'SERENITY_CANCELLED: lettura annullata';
    else if (timeout.aborted) diagnostic = 'SERENITY_TIMEOUT: nessuna risposta completa entro 45 secondi';
    throw new Error(`${diagnostic}. Nessun dato recuperato; non inventare valori.`);
  }
}
