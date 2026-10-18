import app from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Tark AI Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Tark AI Backend] API endpoints available at http://localhost:${PORT}/api`);
});
