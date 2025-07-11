const express = require('express');
const Group = require('../models/Group');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// GET /groups - Lister tous les groupes avec pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { year, promotion } = req.query;
    const skip = (page - 1) * limit;
    // Filtres
    const filter = {};
    if (year) filter.year = year;
    if (promotion) filter.promotion = promotion;
    const groups = await Group.find(filter)
      .populate('promotion')
      .populate('subgroups.students')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    const total = await Group.countDocuments(filter);
    res.json({
      groups,
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

// POST /groups - Créer un nouveau groupe
router.post('/add', requireAdmin, async (req, res) => {
  try {
    const { name, year, promotion, subgroups } = req.body;
    const group = new Group({
      name,
      year,
      promotion,
      subgroups: Array.isArray(subgroups) ? subgroups : []
    });
    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /groups/:groupId/subgroups - Ajouter un sous-groupe à un groupe TD
router.post('/:groupId/subgroups', requireAdmin, async (req, res) => {
  try {
    const { name, students } = req.body;
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Groupe TD non trouvé' });
    }
    if (!Array.isArray(group.subgroups)) group.subgroups = [];
    group.subgroups.push({ name, students });
    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /groups/:groupId/subgroups - Lister les sous-groupes d'un groupe TD
router.get('/:groupId/subgroups', verifyToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).populate('subgroups.students');
    if (!group) {
      return res.status(404).json({ message: 'Groupe TD non trouvé' });
    }
    res.json(group.subgroups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /groups/:groupId/subgroups/:subgroupId - Supprimer un sous-groupe
router.delete('/:groupId/subgroups/:subgroupId', requireAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Groupe TD non trouvé' });
    }
    group.subgroups = group.subgroups.filter(subgroup => subgroup._id.toString() !== req.params.subgroupId);
    await group.save();
    res.json({ message: 'Sous-groupe supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;