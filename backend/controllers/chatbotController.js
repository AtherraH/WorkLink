const axios = require('axios');

const chatbotReply = async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required.' });
  }

  try {
    const systemPrompt = `You are WorkLink Assistant, a helpful support agent for WorkLink — a peer-to-peer labor marketplace app in India that connects customers with semi-skilled and unskilled workers like plumbers, electricians, cleaners, gardeners etc.

Key features of WorkLink:
- Customers post jobs and workers apply
- OTP verification when worker arrives
- Real-time map tracking of worker
- Real-time chat between customer and worker
- AI-based worker suggestions
- Emergency backup worker system if worker is late by 30 minutes
- Job completion photo auto-updates worker portfolio
- Payment Sent and Payment Received buttons
- Rating system that unlocks only after payment
- Admin dashboard for oversight

Be helpful, friendly, concise and professional. Answer in English. Keep responses under 100 words.`;

    const conversationHistory = (history || [])
      .slice(-6)
      .map((msg) => ({
        role: msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));

    conversationHistory.push({ role: 'user', content: message });

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    res.status(200).json({ reply });

  } catch (err) {
console.error('Groq API error:', err.response?.data || err.message);
res.status(500).json({ message: 'AI service unavailable.' });
  }
};

module.exports = { chatbotReply };