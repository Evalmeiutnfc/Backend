const express = require('express');
const Evaluation = require('../models/Evaluation');
const Form = require('../models/Form');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Créer une évaluation
router.post('/create', async (req, res) => {
  const { formId, evaluatorId, studentId, groupNumber, scores } = req.body;
  try {
    const evaluation = new Evaluation({
      form: formId,
      evaluator: evaluatorId,
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

module.exports = router;
