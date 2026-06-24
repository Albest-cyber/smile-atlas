const AIRTABLE_WEBHOOK_URL =
  'https://hooks.airtable.com/workflows/v1/genericWebhook/app7ppkziMHDcai41/wflbAwo1T0VbN84KR/wtrcWp0wXsJy5aLvd';

async function forwardToAirtable(payload) {
  const r = await fetch(AIRTABLE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await r.text().catch(() => '');
  return { ok: r.ok, status: r.status, body };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sample = {
      firstName: 'TEST',
      lastName: 'Connection',
      email: 'test@example.com',
      phone: '+00 000',
      treatment: 'Connection test',
      clinic: '',
      consent: true,
      source: 'Connection test (GET /api/lead)',
      submittedAt: new Date().toISOString(),
      page: 'api-test'
    };
    try {
      const result = await forwardToAirtable(sample);
      res.status(200).json({
        test: true,
        sentToAirtable: true,
        airtableOk: result.ok,
        airtableStatus: result.status,
        airtableResponse: result.body
      });
    } catch (e) {
      res.status(200).json({ test: true, sentToAirtable: false, error: String((e && e.message) || e) });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const data =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (data.website && String(data.website).trim() !== '') {
      res.status(200).json({ ok: true });
      return;
    }

    const payload = {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      treatment: data.treatment || '',
      clinic: data.clinic || '',
      consent: !!data.consent,
      source: data.source || '',
      submittedAt: data.submittedAt || new Date().toISOString(),
      page: data.page || ''
    };

    const result = await forwardToAirtable(payload);
    if (!result.ok) {
      res.status(502).json({ error: 'airtable_failed', status: result.status, detail: result.body });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
