const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

const corsOptions = {
  origin: ' http://localhost:5173', // Remplacez par l'URL de votre frontend si nécessaire
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes (on les ajoutera plus tard)
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/students', require('./routes/student.routes'));
app.use('/api/forms', require('./routes/form.routes'));
app.use('/api/evaluations', require('./routes/evaluation.routes'));
app.use('/api/promotions', require('./routes/promotion.routes'));
app.use('/api/groups', require('./routes/group.routes'));
app.use('/api/subgroups', require('./routes/subgroup.routes'));
app.use('/api/stats', require('./routes/stats.routes')); 

module.exports = app;
