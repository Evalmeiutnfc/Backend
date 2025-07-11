const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema({
  title: { type: String, required: true },
  maxScore: { type: Number, required: true },
  type: { type: String, enum: ['binary', 'scale'], required: true }, // binary = oui/non, scale = échelle graduée (0 à 8)
  notationType: { type: String, enum: ['common', 'individual', 'mixed'], required: true }, // Type de notation
});

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  lines: [lineSchema],
});

const formSchema = new mongoose.Schema({
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  associationType: { type: String, enum: ['student', 'group'], required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  groupCount: { type: Number, default: 0 }, // Déprécié, gardé pour compatibilité
  sections: [sectionSchema],
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
}, { timestamps: true });

// Validation pour garantir l'association exclusive
formSchema.pre('save', function (next) {
  if (this.associationType === 'student' && this.groups.length > 0) {
    return next(new Error('Un formulaire ne peut pas être associé à des étudiants et des groupes en même temps.'));
  }
  if (this.associationType === 'group' && this.students.length > 0) {
    return next(new Error('Un formulaire ne peut pas être associé à des groupes et des étudiants en même temps.'));
  }
  
  // Vérifier qu'au moins une association existe
  if (this.associationType === 'student' && this.students.length === 0) {
    return next(new Error('Un formulaire pour étudiants doit être associé à au moins un étudiant.'));
  }
  if (this.associationType === 'group' && this.groups.length === 0) {
    return next(new Error('Un formulaire pour groupes doit être associé à au moins un groupe.'));
  }
  
  next();
});

// Ajout d'une méthode pour l'export CSV
formSchema.methods.exportToCSV = function () {
  const csvRows = [];

  // Première ligne : notes maximales
  const maxScores = this.sections.flatMap(section => section.lines.map(line => line.maxScore));
  csvRows.push(maxScores.join(','));

  // Lignes suivantes : évaluations
  // Exemple fictif, à compléter avec les données réelles
  this.students.forEach(student => {
    const studentRow = [student.firstName, student.lastName];
    const scores = this.sections.flatMap(section => section.lines.map(line => {
      // Calcul du pourcentage fictif
      return Math.random() * 100; // Remplacez par les scores réels
    }));
    studentRow.push(...scores);
    csvRows.push(studentRow.join(','));
  });

  return csvRows.join('\n');
};

lineSchema.pre('save', function (next) {
  if (this.type === 'scale' && (this.maxScore < 0 || this.maxScore > 8)) {
    return next(new Error('Les scores pour le type scale doivent être compris entre 0 et 8.'));
  }
  next();
});

module.exports = mongoose.model('Form', formSchema);
