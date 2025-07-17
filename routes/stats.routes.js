const express = require('express');
const router = express.Router();

// Import des modèles pour les statistiques
const User = require('../models/User');
const Student = require('../models/Student');
const Promotion = require('../models/Promotion');
const Group = require('../models/Group');
const SubGroup = require('../models/SubGroup');
const Form = require('../models/Form');
const Evaluation = require('../models/Evaluation');

const { verifyToken, requireAdmin, requireProfessorOrAdmin } = require('../middlewares/auth');

// Appliquer le middleware d'authentification sur toutes les routes
router.use(verifyToken);

/**
 * @route GET /api/stats/overview
 * @description Récupère les statistiques globales de l'application.
 * @access Privé (Professeur/Admin)
 */
router.get('/overview', requireProfessorOrAdmin, async (req, res) => {
  try {
    // Compter les documents pour chaque collection
    const studentCount = await Student.countDocuments();
    const promotionCount = await Promotion.countDocuments();
    const groupCount = await Group.countDocuments();
    const subGroupCount = await SubGroup.countDocuments();
    const formCount = await Form.countDocuments();
    const evaluationCount = await Evaluation.countDocuments();

    const stats = {
      students: studentCount,
      promotions: promotionCount,
      groups: groupCount,
      subGroups: subGroupCount,
      forms: formCount,
      evaluations: evaluationCount,
    };

    // Ajouter les stats utilisateurs seulement pour les admins
    if (req.user && req.user.role === 'admin') {
      const userCount = await User.countDocuments();
      stats.users = {
        total: userCount,
        professors: await User.countDocuments({ role: 'professor' }),
        admins: await User.countDocuments({ role: 'admin' }),
      };
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques.', error: error.message });
  }
});

/**
 * @route GET /api/stats/students
 * @description Statistiques détaillées sur les étudiants.
 * @access Privé (Professeur/Admin)
 */
router.get('/students', requireProfessorOrAdmin, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    
    // Répartition par année
    const studentsByYear = await Student.aggregate([
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Étudiants par promotion
    const studentsByPromotion = await Student.aggregate([
      { $unwind: '$promotions' },
      { $group: { _id: '$promotions', count: { $sum: 1 } } },
      { $lookup: { from: 'promotions', localField: '_id', foreignField: '_id', as: 'promotion' } },
      { $unwind: '$promotion' },
      { $project: { promotionName: '$promotion.name', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      total: totalStudents,
      byYear: studentsByYear,
      byPromotion: studentsByPromotion
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

/**
 * @route GET /api/stats/forms
 * @description Statistiques sur les formulaires d'évaluation.
 * @access Privé (Professeur/Admin)
 */
router.get('/forms', requireProfessorOrAdmin, async (req, res) => {
  try {
    const totalForms = await Form.countDocuments();
    
    // Formulaires par type d'association
    const formsByType = await Form.aggregate([
      { $group: { _id: '$associationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Formulaires actifs vs inactifs
    const now = new Date();
    const activeForms = await Form.countDocuments({
      validFrom: { $lte: now },
      validTo: { $gte: now }
    });
    const inactiveForms = totalForms - activeForms;

    res.json({
      total: totalForms,
      active: activeForms,
      inactive: inactiveForms,
      byAssociationType: formsByType
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

/**
 * @route GET /api/stats/evaluations
 * @description Statistiques sur les évaluations.
 * @access Privé (Professeur/Admin)
 */
router.get('/evaluations', requireProfessorOrAdmin, async (req, res) => {
  try {
    const totalEvaluations = await Evaluation.countDocuments();
    
    // Évaluations par type
    const evaluationsByType = await Evaluation.aggregate([
      { $group: { _id: '$evaluationType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Évaluations par mois (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const evaluationsByMonth = await Evaluation.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top 5 des professeurs les plus actifs
    const topProfessors = await Evaluation.aggregate([
      { $group: { _id: '$professor', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'professor' } },
      { $unwind: '$professor' },
      { $project: { professorName: { $concat: ['$professor.firstName', ' ', '$professor.lastName'] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      total: totalEvaluations,
      byType: evaluationsByType,
      byMonth: evaluationsByMonth,
      topProfessors: topProfessors
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

/**
 * @route GET /api/stats/promotions/:promotionId
 * @description Statistiques détaillées pour une promotion spécifique.
 * @access Privé (Professeur/Admin)
 */
router.get('/promotions/:promotionId', requireProfessorOrAdmin, async (req, res) => {
  try {
    const { promotionId } = req.params;
    
    // Vérifier que la promotion existe
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée.' });
    }

    // Nombre d'étudiants dans cette promotion
    const studentsCount = await Student.countDocuments({ promotions: promotionId });
    
    // Nombre de groupes
    const groupsCount = await Group.countDocuments({ promotion: promotionId });
    
    // Nombre de sous-groupes
    const subGroupsCount = await SubGroup.countDocuments({ promotion: promotionId });
    
    // Évaluations dans cette promotion
    const evaluationsCount = await Evaluation.countDocuments({ promotion: promotionId });
    
    // Formulaires associés à cette promotion
    const formsCount = await Form.countDocuments({ promotion: promotionId });

    res.json({
      promotion: {
        id: promotion._id,
        name: promotion.name,
        year: promotion.year
      },
      students: studentsCount,
      groups: groupsCount,
      subGroups: subGroupsCount,
      evaluations: evaluationsCount,
      forms: formsCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

/**
 * @route GET /api/stats/users
 * @description Statistiques sur les utilisateurs (Admin uniquement).
 * @access Privé (Admin uniquement)
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const professors = await User.countDocuments({ role: 'professor' });
    const admins = await User.countDocuments({ role: 'admin' });
    
    // Utilisateurs créés par mois (6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const usersByMonth = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      total: totalUsers,
      professors: professors,
      admins: admins,
      creationsByMonth: usersByMonth
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

module.exports = router;
