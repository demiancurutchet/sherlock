export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system, model } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const modelsToTry = [
    model || 'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen-qwq-32b'
  ];

  // Hard cap to stay under token limits
  const MAX_CHARS = 28000;
  const systemContent = (system || '').slice(0, 2500);
  let userContent = messages?.[messages.length - 1]?.content || '';
  const available = MAX_CHARS - systemContent.length;
  if (userContent.length > available) {
    userContent = userContent.slice(0, available) + '\n[... contenido truncado para respetar límite de tokens]';
  }

  for (const mdl of modelsToTry) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: mdl,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
          ]
        })
      });
      const data = await groqRes.json();
      if (!groqRes.ok) {
        const msg = data.error?.message || '';
        if (msg.includes('too large') || msg.includes('tokens') || msg.includes('decommissioned') || msg.includes('deprecated')) continue;
        return res.status(groqRes.status).json({ error: msg || 'Groq error' });
      }
      return res.status(200).json({ text: data.choices?.[0]?.message?.content || '', model: mdl });
    } catch (e) {
      continue;
    }
  }

  return res.status(500).json({ error: 'No se pudo procesar el request. Intentá reducir el contenido de los archivos.' });
}
