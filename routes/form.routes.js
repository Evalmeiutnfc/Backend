const express = require('express');
const Form = require('../models/Form');
const Student = require('../models/Student');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Ajouter un formulaire
router.post('/add', authenticate, async (req, res) => {
  const { professor, title, associationType, students, groupCount, sections, validFrom, validTo } = req.body;
  try {
    const form = new Form({ professor, title, associationType, students, groupCount, sections, validFrom, validTo });
    await form.save();
    res.status(201).json({ message: 'Formulaire créé avec succès.', form });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister les formulaires valides
router.get('/list', authenticate, async (req, res) => {
  try {
    const currentDate = new Date();
    const forms = await Form.find({
      validFrom: { $lte: currentDate },
      validTo: { $gte: currentDate },
    });
    res.status(200).json(forms);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Modifier un formulaire
router.put('/update/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { title, associationType, students, groupCount, sections, validity } = req.body;
  try {
    const form = await Form.findByIdAndUpdate(id, { title, associationType, students, groupCount, sections, validity }, { new: true });
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé.' });
    }
    res.status(200).json({ message: 'Formulaire mis à jour avec succès.', form });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Supprimer un formulaire
router.delete('/delete/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findByIdAndDelete(id);
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé.' });
    }
    res.status(200).json({ message: 'Formulaire supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Récupérer tous les étudiants d'un groupe évalués pour une même évaluation
router.get('/group-evaluations/:groupNumber', authenticate, async (req, res) => {
  const { groupNumber } = req.params;
  try {
    const students = await Student.find({ group: groupNumber });
    res.status(200).json(students);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
