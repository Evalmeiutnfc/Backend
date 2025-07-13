const express = require('express');
const Student = require('../models/Student');
const Group = require('../models/Group');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// Ajouter un étudiant avec multi-appartenance
router.post('/add', requireAdmin, async (req, res) => {
  const { firstName, lastName, year, promotions, groups, studentNumber, currentPromotion, currentGroup } = req.body;
  try {
    // Validation du champ year
    if (!['BUT1', 'BUT2', 'BUT3'].includes(year)) {
      return res.status(400).json({ message: 'Année invalide. Doit être BUT1, BUT2 ou BUT3.' });
    }
    
    const student = new Student({
      firstName,
      lastName,
      year,
      promotions,
      groups,
      studentNumber,
      currentPromotion,
      currentGroup
    });
    await student.save();
    res.status(201).json({ message: 'Étudiant ajouté avec succès.', student });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister les étudiants avec filtres et pagination
router.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { year, group, promotion, subgroup } = req.query;
    const skip = (page - 1) * limit;
    
    // Filtres
    const filter = {};
    if (year) filter.year = year;
    if (group) filter.groups = group;
    if (promotion) filter.promotions = promotion;
    if (subgroup) filter.subgroups = subgroup;
    
    const students = await Student.find(filter)
      .populate('promotions', 'name year')
      .populate('groups', 'name year')
      .populate('currentPromotion', 'name year')
      .populate('currentGroup', 'name year')
      .populate('subgroups', 'name type')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Student.countDocuments(filter);
    
    res.json({
      students,
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

// Modifier un étudiant
router.put('/update/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, year, promotions, groups, subgroups, studentNumber, currentPromotion, currentGroup } = req.body;
  try {
    // Validation du champ year si fourni
    if (year && !['BUT1', 'BUT2', 'BUT3'].includes(year)) {
      return res.status(400).json({ message: 'Année invalide. Doit être BUT1, BUT2 ou BUT3.' });
    }
    
    const student = await Student.findByIdAndUpdate(
      id, 
      { firstName, lastName, year, promotions, groups, subgroups, studentNumber, currentPromotion, currentGroup }, 
      { new: true }
    ).populate('promotions', 'name year').populate('groups', 'name year').populate('currentPromotion', 'name year').populate('currentGroup', 'name year').populate('subgroups', 'name type');
    
    if (!student) {
      return res.status(404).json({ message: 'Étudiant non trouvé.' });
    }
    res.status(200).json({ message: 'Étudiant mis à jour avec succès.', student });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Supprimer un étudiant
router.delete('/delete/:id', requireAdmin, async (req, res) => {
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

// GET /students/:id/context - Consulter le contexte hiérarchique d'un étudiant
router.get('/:id/context', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('promotions', 'name year')
      .populate('groups', 'name year')
      .populate('subgroups', 'name type');
    
    if (!student) {
      return res.status(404).json({ message: 'Étudiant non trouvé' });
    }
    
    // Récupérer les sous-groupes
    let subgroupsInfo = [];
    if (student.groups && student.groups.length > 0) {
      for (const groupId of student.groups) {
        const group = await Group.findById(groupId).populate('subgroups.students');
        if (group && student.subgroups) {
          student.subgroups.forEach(subgroupName => {
            const subgroup = group.subgroups.find(sg => sg.name === subgroupName);
            if (subgroup) {
              subgroupsInfo.push({
                name: subgroup.name,
                studentsCount: subgroup.students.length,
                groupName: group.name
              });
            }
          });
        }
      }
    }
    
    res.json({
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        year: student.year
      },
      hierarchy: {
        promotions: student.promotions,
        groups: student.groups,
        subgroups: subgroupsInfo
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mettre à jour les affiliations d'un étudiant
router.put('/:id/update-affiliations', requireAdmin, async (req, res) => {
  const { promotions, groups, subgroups } = req.body;
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Étudiant non trouvé.' });

    student.promotions = promotions || student.promotions;
    student.groups = groups || student.groups;
    student.subgroups = subgroups || student.subgroups;

    await student.save();
    res.json({ message: 'Affiliations mises à jour avec succès.', student });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
