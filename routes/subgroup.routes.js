const express = require('express');
const SubGroup = require('../models/SubGroup');
const Student = require('../models/Student'); // Ajout de l'import
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

    // Mettre à jour les étudiants pour y ajouter le nouveau sous-groupe
    if (students && students.length > 0) {
      await Student.updateMany(
        { _id: { $in: students } },
        { $addToSet: { subgroups: subGroup._id } }
      );
    }

    res.status(201).json({ message: 'Sous-groupe ajouté avec succès et étudiants mis à jour.', subGroup });
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
  const { name, type, students: newStudents } = req.body;
  try {
    // 1. Récupérer l'état actuel du sous-groupe
    const subGroupToUpdate = await SubGroup.findById(id);
    if (!subGroupToUpdate) {
      return res.status(404).json({ message: 'Sous-groupe non trouvé.' });
    }
    const oldStudents = subGroupToUpdate.students.map(s => s.toString());

    // 2. Mettre à jour le sous-groupe
    const updatedSubGroup = await SubGroup.findByIdAndUpdate(
      id,
      { name, type, students: newStudents },
      { new: true }
    ).populate('group', 'name').populate('promotion', 'name year').populate('students', 'firstName lastName');

    // 3. Gérer les changements d'étudiants
    const newStudentsStr = newStudents ? newStudents.map(s => s.toString()) : [];
    
    // Étudiants retirés
    const removedStudents = oldStudents.filter(studentId => !newStudentsStr.includes(studentId));
    if (removedStudents.length > 0) {
      await Student.updateMany(
        { _id: { $in: removedStudents } },
        { $pull: { subgroups: id } }
      );
    }

    // Étudiants ajoutés
    const addedStudents = newStudentsStr.filter(studentId => !oldStudents.includes(studentId));
    if (addedStudents.length > 0) {
      await Student.updateMany(
        { _id: { $in: addedStudents } },
        { $addToSet: { subgroups: id } }
      );
    }

    res.json({ message: 'Sous-groupe mis à jour avec succès et étudiants synchronisés.', subGroup: updatedSubGroup });
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

    // Retirer la référence de ce sous-groupe chez tous les étudiants concernés
    if (subGroup.students && subGroup.students.length > 0) {
      await Student.updateMany(
        { _id: { $in: subGroup.students } },
        { $pull: { subgroups: subGroup._id } }
      );
    }

    res.json({ message: 'Sous-groupe supprimé avec succès et étudiants mis à jour.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
