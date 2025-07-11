const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  year: { type: String, enum: ['BUT1', 'BUT2', 'BUT3'], required: true },
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }, // Promotion associée
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // Groupe TD associé
  subgroup: { type: String }, // Nom du sous-groupe (ex: TP1, Projet A)
  isGroup: { type: Boolean, default: false }, // Indique si c'est un groupe ou un étudiant individuel
  studentNumber: { type: String, required: true, unique: true }, // Nouveau champ pour le numéro étudiant
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
