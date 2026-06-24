// ============================================================
//  Smile Atlas — lead proxy (Vercel Serverless Function)
// ============================================================
const AIRTABLE_WEBHOOK_URL =
  'https://hooks.airtable.com/workflows/v1/genericWebhook/app7ppkziMHDcai41/wflbAwo1T0VbN84KR/wtrcWp0wXsJy5aLvd';

export default async function handler(req, res) {
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

    const r = await fetch(AIRTABLE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      res.status(502).json({ error: 'airtable_failed', status: r.status, detail });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
