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
  associationType: { type: String, enum: ['student', 'group', 'subgroup', 'promotion'], required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  subgroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup' }],
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
  sections: [sectionSchema],
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
}, { timestamps: true });

// Validation pour garantir l'association exclusive
formSchema.pre('save', function (next) {
  const associations = [this.students.length, this.groups.length, this.subgroups.length, this.promotion ? 1 : 0];
  const activeAssociations = associations.filter(count => count > 0);

  if (activeAssociations.length > 1) {
    return next(new Error('Un formulaire ne peut être associé qu’à une seule entité à la fois (étudiants, groupes, sous-groupes ou promotion).'));
  }

  if (this.associationType === 'student' && this.students.length === 0) {
    return next(new Error('Un formulaire pour étudiants doit être associé à au moins un étudiant.'));
  }
  if (this.associationType === 'group' && this.groups.length === 0) {
    return next(new Error('Un formulaire pour groupes doit être associé à au moins un groupe.'));
  }
  if (this.associationType === 'subgroup' && this.subgroups.length === 0) {
    return next(new Error('Un formulaire pour sous-groupes doit être associé à au moins un sous-groupe.'));
  }
  if (this.associationType === 'promotion' && !this.promotion) {
    return next(new Error('Un formulaire pour promotion doit être associé à une promotion.'));
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
  if (this.associationType === 'student') {
    this.students.forEach(student => {
      const studentRow = [student.firstName, student.lastName];
      const scores = this.sections.flatMap(section => section.lines.map(line => Math.random() * 100));
      studentRow.push(...scores);
      csvRows.push(studentRow.join(','));
    });
  } else if (this.associationType === 'group') {
    this.groups.forEach(group => {
      const groupRow = [group.name];
      const scores = this.sections.flatMap(section => section.lines.map(line => Math.random() * 100));
      groupRow.push(...scores);
      csvRows.push(groupRow.join(','));
    });
  } else if (this.associationType === 'subgroup') {
    this.subgroups.forEach(subgroup => {
      const subgroupRow = [subgroup.name];
      const scores = this.sections.flatMap(section => section.lines.map(line => Math.random() * 100));
      subgroupRow.push(...scores);
      csvRows.push(subgroupRow.join(','));
    });
  } else if (this.associationType === 'promotion') {
    const promotionRow = [this.promotion.name];
    const scores = this.sections.flatMap(section => section.lines.map(line => Math.random() * 100));
    promotionRow.push(...scores);
    csvRows.push(promotionRow.join(','));
  }

  return csvRows.join('\n');
};

lineSchema.pre('save', function (next) {
  if (this.type === 'scale' && (this.maxScore < 0 || this.maxScore > 8)) {
    return next(new Error('Les scores pour le type scale doivent être compris entre 0 et 8.'));
  }
  next();
});

module.exports = mongoose.model('Form', formSchema);
