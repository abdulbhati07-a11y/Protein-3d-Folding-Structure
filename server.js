import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load env vars
config({ path: '.env.local' });
config(); // fallback to .env

import predictHandler from './api/predictions/predict.js';
import historyHandler from './api/predictions/history.js';
import predictionIdHandler from './api/predictions/[id].js';
import publicPredictionsHandler from './api/predictions/public/predictions.js';
import publicPredictionIdHandler from './api/predictions/public/[id].js';
import profileHandler from './api/users/profile.js';
import projectsHandler from './api/users/projects.js';
import projectsIdHandler from './api/users/projects/[id].js';

const app = express();
app.use(cors());
app.use(express.json());

// Helper to wrap Vercel handlers for Express
const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

app.all('/api/predictions/predict', wrap(predictHandler));
app.all('/api/predictions/history', wrap(historyHandler));
app.all('/api/predictions/history/:id', (req, res) => {
  req.query.id = req.params.id;
  return wrap(predictionIdHandler)(req, res);
});
app.all('/api/predictions/history/:id/share', (req, res) => {
  req.query.id = req.params.id;
  req.url = req.url.replace('/api', ''); // match Vercel URL structure for history.js logic
  return wrap(predictionIdHandler)(req, res);
});
app.all('/api/predictions/public/predictions', wrap(publicPredictionsHandler));
app.all('/api/predictions/public/predictions/:id', (req, res) => {
  req.query.id = req.params.id;
  return wrap(publicPredictionIdHandler)(req, res);
});
app.all('/api/users/profile', wrap(profileHandler));
app.all('/api/users/projects', wrap(projectsHandler));
app.all('/api/users/projects/:id', (req, res) => {
  req.query.id = req.params.id;
  return wrap(projectsIdHandler)(req, res);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Local Dev API running on http://localhost:${PORT}`);
});
