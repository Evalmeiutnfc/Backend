const express = require('express');
const Promotion = require('../models/Promotion');
const Group = require('../models/Group');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// GET /promotions - Lister toutes les promotions
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const promotions = await Promotion.find()
      .populate('groups')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Promotion.countDocuments();
    
    res.json({
      promotions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
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

// POST /promotions - Créer une nouvelle promotion (Admin uniquement)
router.post('/add', requireAdmin, async (req, res) => {
  try {
    const { name, year } = req.body;
    const promotion = new Promotion({ name, year });
    await promotion.save();
    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /promotions/:id - Obtenir une promotion spécifique
router.get('/:id', async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id).populate('groups');
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /promotions/:id - Modifier une promotion (Admin uniquement)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, year } = req.body;
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }
    if (name !== undefined) promotion.name = name;
    if (year !== undefined) promotion.year = year;
    await promotion.save();
    res.json(promotion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /promotions/:id - Supprimer une promotion (Admin uniquement)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }
    await Promotion.deleteOne({ _id: req.params.id });
    res.json({ message: 'Promotion supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ajouter un groupe à une promotion
router.post('/:id/add-group', requireAdmin, async (req, res) => {
  const { groupId } = req.body;
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) return res.status(404).json({ message: 'Promotion non trouvée.' });

    if (!promotion.groups.includes(groupId)) {
      promotion.groups.push(groupId);
      await promotion.save();
    }

    res.json({ message: 'Groupe ajouté à la promotion avec succès.', promotion });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Récupérer les groupes TD d'une promotion
router.get('/:id/groups', async (req, res) => {
  try {
    const groups = await Group.find({ promotion: req.params.id });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
