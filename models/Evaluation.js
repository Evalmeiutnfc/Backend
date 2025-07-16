const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  form: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  groupNumber: { type: Number, default: 0 },
  
  // Structure améliorée des scores pour supporter la notation flexible
  scores: [{
    lineId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Type de notation appliqué pour ce critère spécifique lors de cette évaluation
    notationType: { 
      type: String, 
      enum: ['common', 'individual', 'mixed'],
      required: true 
    },
    // Score commun pour tous les membres du groupe/promotion/sous-groupe
    commonScore: { type: Number },
    // Scores individuels par membre
    individualScores: [{
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
      score: { type: Number, required: true }
    }]
  }],
  
  promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' }, // Promotion associée
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // Groupe TD associé
  subgroup: { type: mongoose.Schema.Types.ObjectId, ref: 'SubGroup' }, // Sous-groupe associé
  
  // Référence à tous les étudiants concernés par cette évaluation
  targetStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  
  // Type d'entité évaluée (promotion, groupe, sous-groupe, étudiant)
  evaluationType: { 
    type: String, 
    enum: ['promotion', 'group', 'subgroup', 'student'],
    required: true 
  }
}, { timestamps: true });

// Validation pour assurer la cohérence avec le formulaire associé
evaluationSchema.pre('save', async function(next) {
  try {
    // Récupérer le formulaire associé
    const Form = mongoose.model('Form');
    const form = await Form.findById(this.form);
    
    if (!form) {
      return next(new Error('Le formulaire associé n\'existe pas'));
    }
    
    // Vérifier que le type d'évaluation correspond au type d'association du formulaire
    if (this.evaluationType !== form.associationType) {
      return next(new Error(`Le type d'évaluation (${this.evaluationType}) doit correspondre au type d'association du formulaire (${form.associationType})`));
    }
    
    // Vérifier que l'entité évaluée existe dans le formulaire
    if (this.evaluationType === 'promotion' && !form.promotion) {
      return next(new Error('Ce formulaire n\'est pas associé à une promotion'));
    } else if (this.evaluationType === 'group' && (!form.groups || !form.groups.includes(this.group))) {
      return next(new Error('Ce formulaire n\'est pas associé à ce groupe'));
    } else if (this.evaluationType === 'subgroup' && (!form.subgroups || !form.subgroups.includes(this.subgroup))) {
      return next(new Error('Ce formulaire n\'est pas associé à ce sous-groupe'));
    } else if (this.evaluationType === 'student' && (!form.students || !form.students.includes(this.student))) {
      return next(new Error('Ce formulaire n\'est pas associé à cet étudiant'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Validation des scores par rapport aux critères du formulaire
evaluationSchema.pre('save', async function(next) {
  try {
    // Récupérer le formulaire associé
    const Form = mongoose.model('Form');
    const form = await Form.findById(this.form).select('sections');
    
    if (!form) {
      return next(new Error('Le formulaire associé n\'existe pas'));
    }
    
    // Récupérer tous les critères (lines) du formulaire
    const formLines = [];
    form.sections.forEach(section => {
      section.lines.forEach(line => {
        formLines.push({
          id: line._id.toString(),
          notationType: line.notationType,
          maxScore: line.maxScore
        });
      });
    });
    
    // Vérifier que chaque score correspond à un critère du formulaire
    // et que le type de notation est respecté
    for (const score of this.scores) {
      const lineId = score.lineId.toString();
      const formLine = formLines.find(line => line.id === lineId);
      
      if (!formLine) {
        return next(new Error(`Le critère ${lineId} n'existe pas dans le formulaire`));
      }
      
      // Vérifier que le type de notation correspond
      if (score.notationType !== formLine.notationType) {
        return next(new Error(`Le type de notation pour le critère ${lineId} (${score.notationType}) ne correspond pas à celui défini dans le formulaire (${formLine.notationType})`));
      }
      
      // Vérifier les scores selon le type de notation
      if ((score.notationType === 'common' || score.notationType === 'mixed') && score.commonScore !== undefined) {
        if (score.commonScore < 0 || score.commonScore > formLine.maxScore) {
          return next(new Error(`Le score commun pour le critère ${lineId} doit être compris entre 0 et ${formLine.maxScore}`));
        }
      }
      
      if ((score.notationType === 'individual' || score.notationType === 'mixed') && score.individualScores && score.individualScores.length > 0) {
        for (const indScore of score.individualScores) {
          if (indScore.score < 0 || indScore.score > formLine.maxScore) {
            return next(new Error(`Le score individuel pour l'étudiant ${indScore.studentId} sur le critère ${lineId} doit être compris entre 0 et ${formLine.maxScore}`));
          }
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
