export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system, model } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        max_tokens: 1500,
        messages: [
          { role: 'system', content: system || 'Sos Sherlock, agente UX senior.' },
          ...messages
        ]
      })
    });
    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(groqRes.status).json({ error: data.error?.message || 'Groq error' });
    res.status(200).json({ text: data.choices?.[0]?.message?.content || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
