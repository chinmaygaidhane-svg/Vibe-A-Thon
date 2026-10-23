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

// POST /simulate/traffic-delay (adds N minutes of delay to a chosen assignment)
router.post('/traffic-delay', async (req, res) => {
  try {
    const { assignmentId, minutes = 15, reason = 'Severe traffic congestion on main arterial' } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required for traffic delay simulation.' });
    }
    const { reportRiderStuck } = await import('../services/trafficDelayService.js');
    const io = req.app.get('io');
    const result = reportRiderStuck({ assignmentId, reason, delayMinutes: parseInt(minutes), io });
    res.json({ message: `Simulated +${minutes}m traffic delay on assignment ${assignmentId}`, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /simulate/handover-codes/:assignmentId (Demo tool for judge quick auto-fill)
router.get('/handover-codes/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { db } = await import('../database.js');
    const asgn = db.prepare('SELECT id, pickup_code, delivery_code FROM assignments WHERE id = ? OR request_id = ?').get(assignmentId, assignmentId);
    if (!asgn) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({
      assignmentId: asgn.id,
      pickupCode: asgn.pickup_code,
      deliveryCode: asgn.delivery_code
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
