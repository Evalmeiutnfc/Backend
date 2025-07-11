const express = require('express');
const Student = require('../models/Student');
const Group = require('../models/Group');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// Ajouter un étudiant
router.post('/add', requireAdmin, async (req, res) => {
  const { firstName, lastName, year, promotion, group, subgroup, studentNumber, isGroup } = req.body;
  try {
    // Validation du champ year
    if (!['BUT1', 'BUT2', 'BUT3'].includes(year)) {
      return res.status(400).json({ message: 'Année invalide. Doit être BUT1, BUT2 ou BUT3.' });
    }
    
    const student = new Student({ 
      firstName, 
      lastName, 
      year, 
      promotion, 
      group, 
      subgroup, 
      studentNumber, 
      isGroup 
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
    if (group) filter.group = group;
    if (promotion) filter.promotion = promotion;
    if (subgroup) filter.subgroup = subgroup;
    
    const students = await Student.find(filter)
      .populate('promotion', 'name year')
      .populate('group', 'name year')
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
  const { firstName, lastName, year, promotion, group, subgroup, studentNumber, isGroup } = req.body;
  try {
    // Validation du champ year si fourni
    if (year && !['BUT1', 'BUT2', 'BUT3'].includes(year)) {
      return res.status(400).json({ message: 'Année invalide. Doit être BUT1, BUT2 ou BUT3.' });
    }
    
    const student = await Student.findByIdAndUpdate(
      id, 
      { firstName, lastName, year, promotion, group, subgroup, studentNumber, isGroup }, 
      { new: true }
    ).populate('promotion', 'name year').populate('group', 'name year');
    
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
      .populate('promotion', 'name year')
      .populate('group', 'name year');
    
    if (!student) {
      return res.status(404).json({ message: 'Étudiant non trouvé' });
    }
    
    // Récupérer le sous-groupe
    const group = await Group.findById(student.group).populate('subgroups.students');
    let subgroupInfo = null;
    
    if (group && student.subgroup) {
      const subgroup = group.subgroups.find(sg => sg.name === student.subgroup);
      if (subgroup) {
        subgroupInfo = {
          name: subgroup.name,
          studentsCount: subgroup.students.length
        };
      }
    }
    
    res.json({
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        year: student.year,
        isGroup: student.isGroup
      },
      hierarchy: {
        promotion: student.promotion,
        group: student.group,
        subgroup: subgroupInfo
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
