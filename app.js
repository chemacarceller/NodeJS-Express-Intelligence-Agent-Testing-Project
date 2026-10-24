require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const IAgentRoutes = require('./routes/IAgentRoutes');
app.use('/api', IAgentRoutes);

module.exports = app;