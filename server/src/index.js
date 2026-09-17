import express from 'express';
import cors from 'cors';
import { analyzeDrilling, sensitivity, optimize } from './services/drillingModel.js';

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'drilling-analysis-api' }));

app.post('/api/analyze', (req, res) => {
  try { res.json(analyzeDrilling(req.body)); }
  catch (err) { res.status(400).json({ message: err.message }); }
});

app.post('/api/sensitivity', (req, res) => {
  try { res.json(sensitivity(req.body)); }
  catch (err) { res.status(400).json({ message: err.message }); }
});

app.post('/api/optimize', (req, res) => {
  try { res.json(optimize(req.body.input || req.body, req.body.ranges || {})); }
  catch (err) { res.status(400).json({ message: err.message }); }
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
