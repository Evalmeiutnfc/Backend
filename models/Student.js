const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  year: { type: String, enum: ['BUT1', 'BUT2', 'BUT3'], required: true },
  promotions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }], // Liste des promotions associées
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }], // Liste des groupes TD associés
  subgroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup' }], // Liste des sous-groupes associés
  studentNumber: { type: String, required: true, unique: true }, // Numéro étudiant unique
  history: [{
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    date: { type: Date, default: Date.now },
  }], // Historique des affiliations
  currentPromotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }, // Promotion actuelle
  currentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // Groupe TD actuel
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
