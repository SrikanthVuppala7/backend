import express from 'express';
import bodyParser from 'body-parser';
import Groq from 'groq-sdk';

const app = express();
app.use(bodyParser.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 🔥 cache config
let flaskApiUrl = null;

async function getFlaskUrl() {
  if (flaskApiUrl) return flaskApiUrl;

  const res = await fetch(
    "https://raw.githubusercontent.com/SrikanthVuppala7/project/main/app-config.json"
  );

  const data = await res.json();

  // ✅ force HTTPS (CRITICAL FIX)
  flaskApiUrl = data.flask_api_url.replace("http://", "https://");

  console.log("Fetched Flask URL:", flaskApiUrl);

  return flaskApiUrl;
}

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
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    const json = JSON.parse(content);

    // 🔥 ALWAYS get latest URL (ngrok safe)
    const FLASK_API_URL = await getFlaskUrl();
    console.log("Forwarding to:", FLASK_API_URL);
    console.log("Payload:", JSON.stringify(json));

    try {
      const flaskRes = await fetch(FLASK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(json)
      });

      console.log("Flask status:", flaskRes.status);

      const flaskText = await flaskRes.text();
      console.log("Flask response:", flaskText);

    } catch (err) {
      console.error("Flask forward FULL error:", err);
    }

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