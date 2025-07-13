const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Ex: "BUT2 Info"
  year: { type: String, required: true }, // Ex: "2025"
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }], // Groupes TD associés
  description: { type: String }, // Description optionnelle de la promotion
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);
