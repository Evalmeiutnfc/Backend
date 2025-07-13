const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  form: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  groupNumber: { type: Number, default: 0 },
  scores: [{
    lineId: { type: mongoose.Schema.Types.ObjectId, required: true },
    score: { type: Number, required: true },
  }],
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }, // Promotion associée
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // Groupe TD associé
  subgroup: { type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup' }, // Sous-groupe associé
}, { timestamps: true });

module.exports = mongoose.model('Evaluation', evaluationSchema);
