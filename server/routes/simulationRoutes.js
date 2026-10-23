import express from 'express';
import {
  advanceRiderSimulation,
  triggerDemandFilledScenario,
  triggerGhostTimeoutScenario,
  fastForwardTime
} from '../services/simulationService.js';

const router = express.Router();

// POST /simulate/rider-move (advance progress by a step, default 0.25)
router.post('/rider-move', (req, res) => {
  try {
    const { assignmentId, step = 0.25 } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required for rider movement simulation.' });
    }

    const io = req.app.get('io');
    const result = advanceRiderSimulation({ assignmentId, step: parseFloat(step), io });
    res.json({ message: 'Rider position advanced on map', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /simulate/receiver-demand-filled (triggers the redirect scenario)
router.post('/receiver-demand-filled', (req, res) => {
  try {
    const { assignmentId } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required for demand-filled redirect simulation.' });
    }

    const io = req.app.get('io');
    const result = triggerDemandFilledScenario({ assignmentId, io });
    res.json({ message: 'Demand-filled redirect executed', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /simulate/rider-timeout (triggers ghost reservation recovery)
router.post('/rider-timeout', (req, res) => {
  try {
    const { assignmentId } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required for ghost timeout simulation.' });
    }

    const io = req.app.get('io');
    const result = triggerGhostTimeoutScenario({ assignmentId, io });
    res.json({ message: 'Ghost reservation timeout recovery executed', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /simulate/fast-forward (shift time to test expiry)
router.post('/fast-forward', (req, res) => {
  try {
    const { minutes = 30 } = req.body;
    const io = req.app.get('io');
    const result = fastForwardTime({ minutes: parseInt(minutes), io });
    res.json({ message: `Time shifted forward by ${minutes} minutes`, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
