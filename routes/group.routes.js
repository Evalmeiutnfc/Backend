const express = require('express');
const Group = require('../models/Group');
const Promotion = require('../models/Promotion'); // Ajout de l'import
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// GET /groups - Lister tous les groupes avec pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { promotion } = req.query;
    const skip = (page - 1) * limit;
    
    // Filtres
    const filter = {};
    if (promotion) filter.promotion = promotion;
    
    const groups = await Group.find(filter)
      .populate('promotion', 'name year')
      .populate('subgroups', 'name type')
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

// POST /groups/add - Créer un nouveau groupe
router.post('/add', requireAdmin, async (req, res) => {
  try {
    const { name, promotion, description } = req.body;
    
    // Validation des champs requis
    if (!name || !promotion) {
      return res.status(400).json({ 
        message: 'Les champs name et promotion sont requis.' 
      });
    }
    
    const group = new Group({
      name,
      promotion,
      description
    });
    
    await group.save();

    // Mettre à jour la promotion pour y ajouter le nouveau groupe
    const promotionDoc = await Promotion.findById(promotion);
    if (promotionDoc) {
      if (!promotionDoc.groups.includes(group._id)) {
        promotionDoc.groups.push(group._id);
        await promotionDoc.save();
      }
    }
    
    // Populer les données pour la réponse
    await group.populate('promotion', 'name year');
    
    res.status(201).json({
      message: 'Groupe créé avec succès et promotion mise à jour.',
      group
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /groups/:groupId/subgroups - Ajouter un sous-groupe à un groupe TD (obsolète - utiliser /api/subgroups/add)
router.post('/:groupId/subgroups', requireAdmin, async (req, res) => {
  res.status(410).json({ 
    message: 'Cette route est obsolète. Utilisez POST /api/subgroups/add pour créer un sous-groupe.',
    newEndpoint: 'POST /api/subgroups/add'
  });
});

// GET /groups/:groupId/subgroups - Lister les sous-groupes d'un groupe TD
router.get('/:groupId/subgroups', verifyToken, async (req, res) => {
  try {
    const SubGroup = require('../models/SubGroup');
    const subgroups = await SubGroup.find({ group: req.params.groupId })
      .populate('students', 'firstName lastName studentNumber');
    res.json(subgroups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /groups/:groupId/subgroups/:subgroupId - Supprimer un sous-groupe
router.delete('/:groupId/subgroups/:subgroupId', requireAdmin, async (req, res) => {
  try {
    const SubGroup = require('../models/SubGroup');
    const subgroup = await SubGroup.findOneAndDelete({ 
      _id: req.params.subgroupId, 
      group: req.params.groupId 
    });
    if (!subgroup) {
      return res.status(404).json({ message: 'Sous-groupe non trouvé' });
    }
    res.json({ message: 'Sous-groupe supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ajouter un sous-groupe à un groupe (obsolète - utiliser /api/subgroups/add)
router.post('/:id/add-subgroup', requireAdmin, async (req, res) => {
  res.status(410).json({ 
    message: 'Cette route est obsolète. Utilisez POST /api/subgroups/add pour créer un sous-groupe.',
    newEndpoint: 'POST /api/subgroups/add'
  });
});

// GET /groups/:id - Récupérer un groupe spécifique
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('promotion', 'name year')
      .populate('subgroups', 'name type students');
      
    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé.' });
    }
    
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /groups/update/:id - Mettre à jour un groupe
router.put('/update/:id', requireAdmin, async (req, res) => {
  try {
    const { name, promotion: newPromotionId, description } = req.body;

    // 1. Récupérer l'état actuel du groupe avant la mise à jour
    const groupToUpdate = await Group.findById(req.params.id);
    if (!groupToUpdate) {
      return res.status(404).json({ message: 'Groupe non trouvé.' });
    }
    const oldPromotionId = groupToUpdate.promotion;

    // 2. Préparer les données de mise à jour
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (newPromotionId !== undefined) updateData.promotion = newPromotionId;
    if (description !== undefined) updateData.description = description;

    // 3. Mettre à jour le groupe
    const updatedGroup = await Group.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('promotion', 'name year').populate('subgroups', 'name type');

    // 4. Mettre à jour les promotions si elle a changé
    if (newPromotionId && oldPromotionId.toString() !== newPromotionId.toString()) {
      // Retirer le groupe de l'ancienne promotion
      if (oldPromotionId) {
        await Promotion.findByIdAndUpdate(oldPromotionId, { $pull: { groups: groupToUpdate._id } });
      }
      // Ajouter le groupe à la nouvelle promotion
      await Promotion.findByIdAndUpdate(newPromotionId, { $addToSet: { groups: groupToUpdate._id } });
    }
    
    res.json({
      message: 'Groupe mis à jour avec succès.',
      group: updatedGroup
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /groups/delete/:id - Supprimer un groupe
router.delete('/delete/:id', requireAdmin, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Groupe non trouvé.' });
    }
    
    // Vérifier s'il y a des sous-groupes associés
    if (group.subgroups && group.subgroups.length > 0) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer le groupe. Il contient des sous-groupes. Supprimez d\'abord les sous-groupes.' 
      });
    }
    
    await Group.findByIdAndDelete(req.params.id);
    res.json({ message: 'Groupe supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;