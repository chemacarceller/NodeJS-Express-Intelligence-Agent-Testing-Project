const IAgentController = require('../MVC/controllers/iAgentController');

const express = require('express');

const router = express.Router();

const iAgentController = new IAgentController();

// Endpoints within /api
router.post('/init-agent', iAgentController.initAgent);
router.post('/send-message', iAgentController.sendMessage);
router.post('/create-custom-model', iAgentController.createCustomModel);
router.post('/fix-model-system', iAgentController.fixModelSystem);

module.exports = router;