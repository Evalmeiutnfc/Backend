const express = require('express');
const Form = require('../models/Form');
const Student = require('../models/Student');
const Group = require('../models/Group');
const Promotion = require('../models/Promotion');
const { verifyToken, requireAdmin, requireProfessorOrAdmin } = require('../middlewares/auth');

const router = express.Router();

// Middleware pour vérifier l'authentification sur toutes les routes
router.use(verifyToken);

// GET /forms - Lister les formulaires avec pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { associationType, professor } = req.query;
    const skip = (page - 1) * limit;
    
    // Filtres
    const filter = {};
    if (associationType) filter.associationType = associationType;
    if (professor) filter.professor = professor;
    
    const forms = await Form.find(filter)
      .populate('professor', 'firstName lastName')
      .populate('students', 'firstName lastName studentNumber')
      .populate('groups', 'name year')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Form.countDocuments(filter);
    
    res.json({
      forms,
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

// POST /forms/assign - Attribuer un formulaire à un niveau spécifique
router.post('/assign', requireAdmin, async (req, res) => {
  try {
    const { formId, level, targetId } = req.body;
    
    // level peut être: 'promotion', 'group', 'subgroup', 'student'
    // targetId est l'ID de l'entité ciblée
    
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé' });
    }
    
    // Logique d'attribution selon le niveau
    switch (level) {
      case 'promotion':
        // Attribuer à tous les groupes de la promotion
        const promotion = await Promotion.findById(targetId).populate('groups');
        if (!promotion) {
          return res.status(404).json({ message: 'Promotion non trouvée' });
        }
        
        form.groups = promotion.groups.map(group => group._id);
        form.associationType = 'group';
        break;
        
      case 'group':
        // Attribuer à un groupe spécifique
        const group = await Group.findById(targetId);
        if (!group) {
          return res.status(404).json({ message: 'Groupe non trouvé' });
        }
        
        form.groups = [targetId];
        form.associationType = 'group';
        break;
        
      case 'subgroup':
        // Attribuer à un sous-groupe spécifique
        const groupWithSubgroup = await Group.findOne({ 'subgroups._id': targetId });
        if (!groupWithSubgroup) {
          return res.status(404).json({ message: 'Sous-groupe non trouvé' });
        }
        
        const subgroup = groupWithSubgroup.subgroups.id(targetId);
        form.students = subgroup.students;
        form.associationType = 'student';
        break;
        
      case 'student':
        // Attribuer à un étudiant spécifique
        const student = await Student.findById(targetId);
        if (!student) {
          return res.status(404).json({ message: 'Étudiant non trouvé' });
        }
        
        form.students = [targetId];
        form.associationType = 'student';
        break;
        
      default:
        return res.status(400).json({ message: 'Niveau invalide. Doit être: promotion, group, subgroup, ou student' });
    }
    
    await form.save();
    res.json({ message: 'Formulaire attribué avec succès', form });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /forms/add - Ajouter un formulaire
router.post('/add', requireProfessorOrAdmin, async (req, res) => {
  const { professor, title, associationType, students, groups, sections, validFrom, validTo } = req.body;
  try {
    // Validation des dates
    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);
    
    if (fromDate >= toDate) {
      return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début' });
    }
    
    // Validation des sections
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ message: 'Au moins une section est requise' });
    }
    
    // Validation de la structure des sections
    for (const section of sections) {
      if (!section.title || !section.lines || !Array.isArray(section.lines) || section.lines.length === 0) {
        return res.status(400).json({ message: 'Chaque section doit avoir un titre et au moins une ligne' });
      }
      
      // Validation des lignes
      for (const line of section.lines) {
        if (!line.title || line.maxScore === undefined || !line.type || !line.notationType) {
          return res.status(400).json({ message: 'Chaque ligne doit avoir un titre, un score max, un type et un type de notation' });
        }
        
        if (typeof line.maxScore !== 'number' || line.maxScore < 0) {
          return res.status(400).json({ message: 'Le score maximum doit être un nombre positif' });
        }
        
        if (!['binary', 'scale'].includes(line.type)) {
          return res.status(400).json({ message: 'Le type de ligne doit être binary ou scale' });
        }
        
        if (!['common', 'individual', 'mixed'].includes(line.notationType)) {
          return res.status(400).json({ message: 'Le type de notation doit être common, individual ou mixed' });
        }
        
        if (line.type === 'scale' && (line.maxScore < 0 || line.maxScore > 8)) {
          return res.status(400).json({ message: 'Les scores pour le type scale doivent être compris entre 0 et 8' });
        }
        
        if (line.type === 'binary' && line.maxScore !== 1) {
          return res.status(400).json({ message: 'Les scores pour le type binary doivent être égaux à 1' });
        }
      }
    }
    
    const formData = { 
      professor, 
      title, 
      associationType, 
      sections, 
      validFrom: fromDate, 
      validTo: toDate 
    };
    
    // Ajouter students ou groups selon le type d'association
    if (associationType === 'student' && students && students.length > 0) {
      formData.students = students;
    } else if (associationType === 'group' && groups && groups.length > 0) {
      formData.groups = groups;
    } else {
      return res.status(400).json({ 
        message: `Pour un formulaire de type ${associationType}, au moins un ${associationType === 'student' ? 'étudiant' : 'groupe'} doit être associé` 
      });
    }
    
    // Garder groupCount pour compatibilité si fourni
    if (req.body.groupCount !== undefined) {
      formData.groupCount = req.body.groupCount;
    }
    
    const form = new Form(formData);
    await form.save();
    
    // Populer les données pour la réponse
    await form.populate([
      { path: 'professor', select: 'firstName lastName' },
      { path: 'students', select: 'firstName lastName studentNumber' },
      { path: 'groups', select: 'name year' }
    ]);
    
    res.status(201).json({ message: 'Formulaire créé avec succès.', form });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// GET /forms/list - Lister les formulaires valides avec pagination
router.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { associationType, professor } = req.query;
    const skip = (page - 1) * limit;
    
    const currentDate = new Date();
    
    // Filtres de base + filtre de validité
    const filter = {
      validFrom: { $lte: currentDate },
      validTo: { $gte: currentDate },
    };
    
    if (associationType) filter.associationType = associationType;
    if (professor) filter.professor = professor;
    
    const forms = await Form.find(filter)
      .populate('professor', 'firstName lastName')
      .populate('students', 'firstName lastName studentNumber')
      .populate('groups', 'name year')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await Form.countDocuments(filter);
    
    res.json({
      forms,
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

// PUT /forms/update/:id - Modifier un formulaire
router.put('/update/:id', requireProfessorOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, associationType, students, groups, sections, validFrom, validTo } = req.body;
  try {
    const form = await Form.findById(id);
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé.' });
    }
    
    // Validation des dates si fournies
    if (validFrom && validTo) {
      const fromDate = new Date(validFrom);
      const toDate = new Date(validTo);
      
      if (fromDate >= toDate) {
        return res.status(400).json({ message: 'La date de fin doit être postérieure à la date de début' });
      }
    }
    
    // Validation des sections si fournies
    if (sections) {
      if (!Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ message: 'Au moins une section est requise' });
      }
      
      for (const section of sections) {
        if (!section.title || !section.lines || !Array.isArray(section.lines) || section.lines.length === 0) {
          return res.status(400).json({ message: 'Chaque section doit avoir un titre et au moins une ligne' });
        }
        
        for (const line of section.lines) {
          if (!line.title || line.maxScore === undefined || !line.type || !line.notationType) {
            return res.status(400).json({ message: 'Chaque ligne doit avoir un titre, un score max, un type et un type de notation' });
          }
          
          if (typeof line.maxScore !== 'number' || line.maxScore < 0) {
            return res.status(400).json({ message: 'Le score maximum doit être un nombre positif' });
          }
          
          if (!['binary', 'scale'].includes(line.type)) {
            return res.status(400).json({ message: 'Le type de ligne doit être binary ou scale' });
          }
          
          if (!['common', 'individual', 'mixed'].includes(line.notationType)) {
            return res.status(400).json({ message: 'Le type de notation doit être common, individual ou mixed' });
          }
          
          if (line.type === 'scale' && (line.maxScore < 0 || line.maxScore > 8)) {
            return res.status(400).json({ message: 'Les scores pour le type scale doivent être compris entre 0 et 8' });
          }
          
          if (line.type === 'binary' && line.maxScore !== 1) {
            return res.status(400).json({ message: 'Les scores pour le type binary doivent être égaux à 1' });
          }
        }
      }
    }
    
    // Préparer les données de mise à jour
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (associationType !== undefined) updateData.associationType = associationType;
    if (sections !== undefined) updateData.sections = sections;
    if (validFrom !== undefined) updateData.validFrom = new Date(validFrom);
    if (validTo !== undefined) updateData.validTo = new Date(validTo);
    
    // Gérer les associations
    if (associationType === 'student') {
      if (students !== undefined) updateData.students = students;
      updateData.groups = []; // Vider les groupes
    } else if (associationType === 'group') {
      if (groups !== undefined) updateData.groups = groups;
      updateData.students = []; // Vider les étudiants
    }
    
    const updatedForm = await Form.findByIdAndUpdate(id, updateData, { new: true })
      .populate('professor', 'firstName lastName')
      .populate('students', 'firstName lastName studentNumber')
      .populate('groups', 'name year');
    
    res.status(200).json({ message: 'Formulaire mis à jour avec succès.', form: updatedForm });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// DELETE /forms/delete/:id - Supprimer un formulaire
router.delete('/delete/:id', requireProfessorOrAdmin, async (req, res) => {
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

// GET /forms/:id - Récupérer un formulaire spécifique
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findById(id)
      .populate('professor', 'firstName lastName')
      .populate('students', 'firstName lastName studentNumber')
      .populate('groups', 'name year');
    
    if (!form) {
      return res.status(404).json({ message: 'Formulaire non trouvé.' });
    }
    
    res.status(200).json(form);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// GET /forms/group-evaluations/:groupNumber - Récupérer tous les étudiants d'un groupe évalués pour une même évaluation
router.get('/group-evaluations/:groupNumber', async (req, res) => {
  const { groupNumber } = req.params;
  try {
    // Chercher les étudiants par groupe TD
    const students = await Student.find({ group: groupNumber })
      .populate('promotion', 'name year')
      .populate('group', 'name year');
    
    if (students.length === 0) {
      return res.status(404).json({ message: 'Aucun étudiant trouvé pour ce groupe' });
    }
    
    res.status(200).json(students);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
