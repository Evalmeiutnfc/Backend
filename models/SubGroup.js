const mongoose = require('mongoose');

const subGroupSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Nom du sous-groupe (ex: TP A, Projet X)
  type: { type: String, required: true }, // Type de sous-groupe (ex: TP, Projet)
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true }, // Groupe TD parent
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', required: true }, // Promotion associée
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }], // Étudiants associés
  evaluations: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    score: { type: Number },
    comments: { type: String }
  }] // Évaluations des étudiants
}, { timestamps: true });

// Middleware pour maintenir la relation bidirectionnelle avec Group
subGroupSchema.post('save', async function() {
  try {
    const Group = require('./Group');
    const group = await Group.findById(this.group);
    if (group && !group.subgroups.includes(this._id)) {
      group.subgroups.push(this._id);
      await group.save();
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la relation Group-SubGroup:', error);
  }
});

// Middleware pour nettoyer la relation lors de la suppression
subGroupSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const Group = require('./Group');
      await Group.findByIdAndUpdate(
        doc.group,
        { $pull: { subgroups: doc._id } }
      );
    } catch (error) {
      console.error('Erreur lors du nettoyage de la relation Group-SubGroup:', error);
    }
  }
});

module.exports = mongoose.model('SubGroup', subGroupSchema);
