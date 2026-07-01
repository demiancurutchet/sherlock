export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system, model } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Try models in order of preference, fallback if one fails
  const modelsToTry = [
    model || 'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it'
  ];

  // Truncate system + messages to stay under ~9000 tokens (~36000 chars)
  const MAX_TOTAL_CHARS = 32000;
  let systemContent = (system || '').slice(0, 4000);
  let userContent = messages?.[messages.length - 1]?.content || '';
  
  // If total is too big, truncate user content
  const available = MAX_TOTAL_CHARS - systemContent.length;
  if (userContent.length > available) {
    userContent = userContent.slice(0, available) + '\n[... contenido truncado para respetar límite de tokens]';
  }

  const truncatedMessages = [{ role: 'user', content: userContent }];

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
            ...truncatedMessages
          ]
        })
      });
      const data = await groqRes.json();
      if (!groqRes.ok) {
        // If token limit error, try next model
        if (data.error?.message?.includes('too large') || data.error?.message?.includes('tokens')) continue;
        return res.status(groqRes.status).json({ error: data.error?.message || 'Groq error' });
      }
      return res.status(200).json({ text: data.choices?.[0]?.message?.content || '', model: mdl });
    } catch (e) {
      continue;
    }
  }
  
  return res.status(500).json({ error: 'Todos los modelos fallaron. Intentá reducir el tamaño de los archivos.' });
}
