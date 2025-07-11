const express = require('express');
const Evaluation = require('../models/Evaluation');
const Form = require('../models/Form');
const { verifyToken, requireAdmin, requireProfessorOrAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// Créer une évaluation
router.post('/add', requireProfessorOrAdmin, async (req, res) => {
  const { formId, professorId, studentId, groupNumber, scores, promotion, group, subgroup } = req.body;
  try {
    // Validation des scores
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ message: 'Au moins un score est requis' });
    }
    
    // Validation de la structure des scores
    for (const score of scores) {
      if (!score.lineId || typeof score.score !== 'number') {
        return res.status(400).json({ message: 'Chaque score doit avoir un lineId et un score numérique' });
      }
      
      if (score.score < 0) {
        return res.status(400).json({ message: 'Les scores ne peuvent pas être négatifs' });
      }
    }
    
    // Vérification que le formulaire existe
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé' });
    }
    
    const evaluation = new Evaluation({
      form: formId,
      professor: professorId,
      student: studentId,
      groupNumber: groupNumber || 0,
      scores,
      promotion,
      group,
      subgroup
    });
    await evaluation.save();
    
    // Populer les données pour la réponse
    await evaluation.populate([
      { path: 'form', select: 'title associationType' },
      { path: 'professor', select: 'firstName lastName' },
      { path: 'student', select: 'firstName lastName studentNumber' },
      { path: 'promotion', select: 'name year' },
      { path: 'group', select: 'name year' }
    ]);
    
    res.status(201).json({ message: 'Évaluation créée avec succès.', evaluation });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Modifier une évaluation
router.put('/update/:id', requireProfessorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { scores, promotion, group, subgroup, groupNumber } = req.body;
  try {
    const evaluation = await Evaluation.findById(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Évaluation non trouvée.' });
    }
    
    // Validation des scores si fournis
    if (scores) {
      if (!Array.isArray(scores) || scores.length === 0) {
        return res.status(400).json({ message: 'Au moins un score est requis' });
      }
      
      for (const score of scores) {
        if (!score.lineId || typeof score.score !== 'number') {
          return res.status(400).json({ message: 'Chaque score doit avoir un lineId et un score numérique' });
        }
        
        if (score.score < 0) {
          return res.status(400).json({ message: 'Les scores ne peuvent pas être négatifs' });
        }
      }
    }
    
    // Préparer les données de mise à jour
    const updateData = {};
    if (scores !== undefined) updateData.scores = scores;
    if (promotion !== undefined) updateData.promotion = promotion;
    if (group !== undefined) updateData.group = group;
    if (subgroup !== undefined) updateData.subgroup = subgroup;
    if (groupNumber !== undefined) updateData.groupNumber = groupNumber;
    
    const updatedEvaluation = await Evaluation.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).populate([
      { path: 'form', select: 'title associationType' },
      { path: 'professor', select: 'firstName lastName' },
      { path: 'student', select: 'firstName lastName studentNumber' },
      { path: 'promotion', select: 'name year' },
      { path: 'group', select: 'name year' }
    ]);
    
    res.status(200).json({ message: 'Évaluation mise à jour avec succès.', evaluation: updatedEvaluation });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Exporter les évaluations en CSV
router.get('/export/:formId', async (req, res) => {
  const { formId } = req.params;
  try {
    const form = await Form.findById(formId).populate('students');
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé.' });
    }
    const csvData = form.exportToCSV();
    res.header('Content-Type', 'text/csv');
    res.attachment(`${form.title}-evaluations.csv`);
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister toutes les évaluations d'un formulaire avec pagination
router.get('/list/:formId', async (req, res) => {
  const { formId } = req.params;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const evaluations = await Evaluation.find({ form: formId })
      .populate('professor', 'firstName lastName')
      .populate('student', 'firstName lastName studentNumber')
      .populate('form', 'title associationType')
      .populate('promotion', 'name year')
      .populate('group', 'name year')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Evaluation.countDocuments({ form: formId });
    
    res.json({
      evaluations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister les évaluations d'un professeur avec pagination
router.get('/professor/:professorId', async (req, res) => {
  const { professorId } = req.params;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const evaluations = await Evaluation.find({ professor: professorId })
      .populate('student', 'firstName lastName studentNumber')
      .populate('form', 'title validFrom validTo associationType')
      .populate('promotion', 'name year')
      .populate('group', 'name year')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Evaluation.countDocuments({ professor: professorId });
    
    res.json({
      evaluations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Récupérer une évaluation spécifique
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const evaluation = await Evaluation.findById(id)
      .populate('professor', 'firstName lastName')
      .populate('student', 'firstName lastName studentNumber')
      .populate('form', 'title associationType sections')
      .populate('promotion', 'name year')
      .populate('group', 'name year');
    
    if (!evaluation) {
      return res.status(404).json({ message: 'Évaluation non trouvée.' });
    }
    res.status(200).json(evaluation);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Supprimer une évaluation
router.delete('/delete/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const evaluation = await Evaluation.findByIdAndDelete(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Évaluation non trouvée.' });
    }
    res.status(200).json({ message: 'Évaluation supprimée avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// GET /evaluations/stats/:formId - Obtenir les statistiques d'un formulaire
router.get('/stats/:formId', async (req, res) => {
  const { formId } = req.params;
  try {
    const form = await Form.findById(formId).select('title sections');
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé' });
    }
    
    const evaluations = await Evaluation.find({ form: formId })
      .populate('student', 'firstName lastName studentNumber');
    
    if (evaluations.length === 0) {
      return res.json({
        form: form.title,
        totalEvaluations: 0,
        stats: []
      });
    }
    
    // Calculer les statistiques par ligne
    const lineStats = {};
    
    form.sections.forEach(section => {
      section.lines.forEach(line => {
        const lineId = line._id.toString();
        lineStats[lineId] = {
          title: line.title,
          maxScore: line.maxScore,
          type: line.type,
          scores: [],
          average: 0,
          min: null,
          max: null
        };
      });
    });
    
    // Collecter tous les scores
    evaluations.forEach(evaluation => {
      evaluation.scores.forEach(score => {
        const lineId = score.lineId.toString();
        if (lineStats[lineId]) {
          lineStats[lineId].scores.push(score.score);
        }
      });
    });
    
    // Calculer les statistiques
    Object.keys(lineStats).forEach(lineId => {
      const stats = lineStats[lineId];
      if (stats.scores.length > 0) {
        stats.average = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
        stats.min = Math.min(...stats.scores);
        stats.max = Math.max(...stats.scores);
      }
    });
    
    res.json({
      form: form.title,
      totalEvaluations: evaluations.length,
      stats: lineStats
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// POST /evaluations/validate-scores - Valider les scores par rapport au formulaire
router.post('/validate-scores', async (req, res) => {
  const { formId, scores } = req.body;
  try {
    // Récupérer le formulaire avec ses sections
    const form = await Form.findById(formId).select('sections');
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé' });
    }
    
    // Récupérer tous les lineId du formulaire
    const validLineIds = [];
    const lineMaxScores = {};
    
    form.sections.forEach(section => {
      section.lines.forEach(line => {
        validLineIds.push(line._id.toString());
        lineMaxScores[line._id.toString()] = line.maxScore;
      });
    });
    
    // Valider chaque score
    const validationErrors = [];
    
    for (const score of scores) {
      const lineIdStr = score.lineId.toString();
      
      // Vérifier que le lineId existe dans le formulaire
      if (!validLineIds.includes(lineIdStr)) {
        validationErrors.push(`LineId ${lineIdStr} n'existe pas dans le formulaire`);
        continue;
      }
      
      // Vérifier que le score ne dépasse pas le maximum
      const maxScore = lineMaxScores[lineIdStr];
      if (score.score > maxScore) {
        validationErrors.push(`Score ${score.score} dépasse le maximum ${maxScore} pour la ligne ${lineIdStr}`);
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Erreurs de validation des scores',
        errors: validationErrors 
      });
    }
    
    res.json({ message: 'Scores valides', valid: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// GET /evaluations - Lister les évaluations avec pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { form, professor, student, group, promotion, subgroup } = req.query;
    const skip = (page - 1) * limit;
    
    // Filtres
    const filter = {};
    if (form) filter.form = form;
    if (professor) filter.professor = professor;
    if (student) filter.student = student;
    if (group) filter.group = group;
    if (promotion) filter.promotion = promotion;
    if (subgroup) filter.subgroup = subgroup;
    
    const evaluations = await Evaluation.find(filter)
      .populate('form', 'title associationType')
      .populate('professor', 'firstName lastName')
      .populate('student', 'firstName lastName studentNumber')
      .populate('group', 'name year')
      .populate('promotion', 'name year')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Evaluation.countDocuments(filter);
    
    res.json({
      evaluations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
