const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  // ...existing code...
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', required: true }, // Promotion associée
  subgroups: [{
    name: { type: String, required: true }, // Nom du sous-groupe (ex: TP1, Projet A)
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }] // Étudiants du sous-groupe
  }],
  // ...existing code...
});

module.exports = mongoose.model('Group', groupSchema);