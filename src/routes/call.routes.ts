import { Router } from 'express';
import { CallController } from '../controllers/call.controller';

const router = Router();
const callController = new CallController();

// Call management routes
router.post('/calls', callController.createCall);
router.get('/calls/:id', callController.getCall);
router.patch('/calls/:id', callController.updateCall);
router.get('/calls', callController.listCalls);

// Metrics route
router.get('/metrics', callController.getMetrics);

// Webhook route
router.post('/callbacks/call-status', callController.handleWebhookCallback);

export default router;