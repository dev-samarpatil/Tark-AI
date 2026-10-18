import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json());

// API Prefix
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

export default app;
