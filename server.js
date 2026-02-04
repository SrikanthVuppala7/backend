// server.js
import express from 'express';
import bodyParser from 'body-parser';
import Groq from 'groq-sdk';

const app = express();
app.use(bodyParser.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/parse-intent', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const prompt = `
You are a Thought-to-Action Reasoning (TAR) model for robotic manipulation.
Convert the user instruction into a structured action chain in STRICT JSON.

Instruction: "${text}"

Return ONLY JSON with this schema:
{
  "actions": [
    { "action": "PICK", "object": "...", "count": number },
    { "action": "PLACE", "target": "..." }
  ]
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // fast + free tier friendly
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    const json = JSON.parse(content);
    res.json(json);
  } catch (err) {
    console.error('Groq error:', err?.message || err);
    res.status(502).json({ error: 'LLM processing failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TAR backend (Groq) running on port ${PORT}`);
});
