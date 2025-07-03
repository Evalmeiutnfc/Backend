const express = require('express');
const Student = require('../models/Student');

const router = express.Router();

// Ajouter un étudiant
router.post('/add', async (req, res) => {
  const { firstName, lastName, year, group, studentNumber, isGroup } = req.body;
  try {
    const student = new Student({ firstName, lastName, year, group, studentNumber, isGroup });
    await student.save();
    res.status(201).json({ message: 'Étudiant ajouté avec succès.', student });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister les étudiants avec filtres
router.get('/list', async (req, res) => {
  const { year, group } = req.query;
  try {
    const filter = {};
    if (year) filter.year = year;
    if (group) filter.group = group;

    const students = await Student.find(filter);
    res.status(200).json(students);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Modifier un étudiant
router.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, year, group, studentNumber, isGroup } = req.body;
  try {
    const student = await Student.findByIdAndUpdate(id, { firstName, lastName, year, group, studentNumber, isGroup }, { new: true });
    if (!student) {
      return res.status(404).json({ message: 'Étudiant non trouvé.' });
    }
    res.status(200).json({ message: 'Étudiant mis à jour avec succès.', student });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Supprimer un étudiant
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({ message: 'Étudiant non trouvé.' });
    }
    res.status(200).json({ message: 'Étudiant supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
