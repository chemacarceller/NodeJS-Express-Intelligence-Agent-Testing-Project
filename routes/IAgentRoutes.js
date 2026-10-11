const IAgentController = require('../MVC/controllers/iAgentController');

const express = require('express');

const router = express.Router();

const MODEL = 'llama3.2:latest'

const iAgentController = new IAgentController(MODEL);

router.post('/init-agent', iAgentController.initAgent);
router.post('/send-message', iAgentController.sendMessage);

module.exports = router;