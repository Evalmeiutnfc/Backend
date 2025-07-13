const express = require('express');
const SubGroup = require('../models/SubGroup');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// Ajouter un sous-groupe
router.post('/add', requireAdmin, async (req, res) => {
  const { name, type, group, promotion, students } = req.body;
  try {
    const subGroup = new SubGroup({ name, type, group, promotion, students });
    await subGroup.save();
    res.status(201).json({ message: 'Sous-groupe ajouté avec succès.', subGroup });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister les sous-groupes
router.get('/list', async (req, res) => {
  try {
    const subGroups = await SubGroup.find()
      .populate('group', 'name')
      .populate('promotion', 'name year')
      .populate('students', 'firstName lastName');
    res.json(subGroups);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Mettre à jour un sous-groupe
router.put('/update/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, type, students } = req.body;
  try {
    const subGroup = await SubGroup.findByIdAndUpdate(
      id,
      { name, type, students },
      { new: true }
    ).populate('group', 'name').populate('promotion', 'name year').populate('students', 'firstName lastName');

    if (!subGroup) {
      return res.status(404).json({ message: 'Sous-groupe non trouvé.' });
    }
    res.json({ message: 'Sous-groupe mis à jour avec succès.', subGroup });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Supprimer un sous-groupe
router.delete('/delete/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const subGroup = await SubGroup.findByIdAndDelete(id);
    if (!subGroup) {
      return res.status(404).json({ message: 'Sous-groupe non trouvé.' });
    }
    res.json({ message: 'Sous-groupe supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
