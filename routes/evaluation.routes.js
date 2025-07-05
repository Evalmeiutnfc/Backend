const express = require('express');
const Evaluation = require('../models/Evaluation');
const Form = require('../models/Form');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Créer une évaluation
router.post('/create', async (req, res) => {
  const { formId, professorId, studentId, groupNumber, scores } = req.body;
  try {
    const evaluation = new Evaluation({
      form: formId,
      professor: professorId,
      student: studentId,
      groupNumber,
      scores,
    });
    await evaluation.save();
    res.status(201).json({ message: 'Évaluation créée avec succès.', evaluation });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Modifier une évaluation
router.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { scores } = req.body;
  try {
    const evaluation = await Evaluation.findByIdAndUpdate(id, { scores, updatedAt: Date.now() }, { new: true });
    if (!evaluation) {
      return res.status(404).json({ message: 'Évaluation non trouvée.' });
    }
    res.status(200).json({ message: 'Évaluation mise à jour avec succès.', evaluation });
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

// Lister toutes les évaluations d'un formulaire
router.get('/list/:formId', async (req, res) => {
  const { formId } = req.params;
  try {
    const evaluations = await Evaluation.find({ form: formId })
      .populate('professor', 'firstName lastName')
      .populate('student', 'firstName lastName studentNumber')
      .populate('form', 'title');
    res.status(200).json(evaluations);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister les évaluations d'un professeur
router.get('/professor/:professorId', async (req, res) => {
  const { professorId } = req.params;
  try {
    const evaluations = await Evaluation.find({ professor: professorId })
      .populate('student', 'firstName lastName studentNumber')
      .populate('form', 'title validFrom validTo');
    res.status(200).json(evaluations);
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
      .populate('form');
    if (!evaluation) {
      return res.status(404).json({ message: 'Évaluation non trouvée.' });
    }
    res.status(200).json(evaluation);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Supprimer une évaluation
router.delete('/delete/:id', async (req, res) => {
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

module.exports = router;
