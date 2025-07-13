const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', required: true }, // Promotion associée
  subgroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup' }], // Référence aux sous-groupes associés
  description: { type: String }, // Description optionnelle du groupe
  name: { type: String, required: true }, // Nom du groupe (ex: TD1, TD2)
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);