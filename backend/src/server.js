import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { db } from './services/persistence/db.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Tark AI Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Tark AI Backend] API endpoints available at http://localhost:${PORT}/api`);
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE') {
    console.log(`[Tark AI Backend] Live Groq AI integration active (Model: ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'})`);
  } else {
    console.log(`[Tark AI Backend] AI Coach running in deterministic local fallback mode (GROQ_API_KEY not configured)`);
  }
});
