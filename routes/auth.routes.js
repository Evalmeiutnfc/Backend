const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middlewares/auth');
const { requireAdmin, preventSelfModification } = require('../middlewares/admin');
const {
  handleServerError,
  findUserById,
  validateRole,
  checkEmailDuplicate,
  checkLoginDuplicate,
  hashPassword,
  validatePasswordLength,
  formatUserResponse
} = require('../utils/userUtils');

const router = express.Router();

// Inscription
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, login, password, role } = req.body;
  try {
    const existingUser = await checkEmailDuplicate(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email déjà utilisé.' });
    }

    const user = new User({ firstName, lastName, email, login, password, role });
    await user.save();
    res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Connexion
router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const user = await User.findOne({ login });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ token, user: { id: user._id, login, role: user.role } });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Récupérer le profil utilisateur connecté
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.id, res);
    if (!user) return;
    
    res.status(200).json(user);
  } catch (err) {
    handleServerError(res, err);
  }
});

// Mettre à jour le profil utilisateur
router.put('/profile', authenticate, async (req, res) => {
  const { firstName, lastName, email } = req.body;
  try {
    // Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
    if (email) {
      const existingUser = await checkEmailDuplicate(email, req.user.id);
      if (existingUser) {
        return res.status(400).json({ message: 'Email déjà utilisé par un autre utilisateur.' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, email },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    res.status(200).json({ 
      message: 'Profil mis à jour avec succès.', 
      user: updatedUser 
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Changer le mot de passe
router.put('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Validation des champs requis
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      message: 'Mot de passe actuel et nouveau mot de passe requis.' 
    });
  }

  // Validation de la longueur du nouveau mot de passe
  if (!validatePasswordLength(newPassword)) {
    return res.status(400).json({ 
      message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' 
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect.' });
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await hashPassword(newPassword);

    // Mettre à jour le mot de passe
    await User.findByIdAndUpdate(req.user.id, { password: hashedNewPassword });

    res.status(200).json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Supprimer le compte utilisateur
router.delete('/delete-account', authenticate, async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ message: 'Mot de passe requis pour supprimer le compte.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mot de passe incorrect.' });
    }

    // Supprimer l'utilisateur
    await User.findByIdAndDelete(req.user.id);

    res.status(200).json({ message: 'Compte supprimé avec succès.' });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Lister tous les utilisateurs (admin seulement)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    handleServerError(res, err);
  }
});

// Mettre à jour le rôle d'un utilisateur (admin seulement)
router.put('/users/:id/role', authenticate, requireAdmin, preventSelfModification, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validation du rôle
  if (!validateRole(role)) {
    return res.status(400).json({ message: 'Rôle invalide. Valeurs acceptées: admin, professor.' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    res.status(200).json({ 
      message: 'Rôle utilisateur mis à jour avec succès.', 
      user: updatedUser 
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Vérifier la validité du token
router.get('/verify-token', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.id, res);
    if (!user) return;
    
    res.status(200).json({ 
      valid: true, 
      user: formatUserResponse(user)
    });
  } catch (err) {
    res.status(401).json({ valid: false, message: 'Token invalide.' });
  }
});

// Déconnexion (optionnel - côté frontend)
router.post('/logout', authenticate, async (req, res) => {
  // Note: Avec JWT, la déconnexion se fait généralement côté frontend
  // en supprimant le token du localStorage
  res.status(200).json({ message: 'Déconnexion réussie.' });
});

// Récupérer les utilisateurs avec le rôle de professeur
router.get('/users/professors', authenticate, requireAdmin, async (req, res) => {
  try {
    const professors = await User.find({ role: 'professor' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json(professors);
  } catch (err) {
    handleServerError(res, err);
  }
});

// Récupérer les utilisateurs avec le rôle d'administrateur
router.get('/users/admins', authenticate, requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json(admins);
  } catch (err) {
    handleServerError(res, err);
  }
});

// Supprimer un utilisateur (admin seulement)
router.delete('/users/:id', authenticate, requireAdmin, preventSelfModification, async (req, res) => {
  const { id } = req.params;
  
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    res.status(200).json({ 
      message: 'Utilisateur supprimé avec succès.',
      deletedUser: formatUserResponse(deletedUser)
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Rechercher des utilisateurs avec filtres (admin seulement)
router.get('/users/search', authenticate, requireAdmin, async (req, res) => {
  try {
    const { 
      search, 
      role, 
      page = 1, 
      limit = 10 
    } = req.query;

    // Construire les filtres
    const filters = {};
    
    if (validateRole(role)) {
      filters.role = role;
    }

    if (search) {
      filters.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { login: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filters)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filters);

    res.status(200).json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Réinitialiser le mot de passe d'un utilisateur (admin seulement)
router.put('/users/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  // Validation du nouveau mot de passe
  if (!validatePasswordLength(newPassword)) {
    return res.status(400).json({ 
      message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' 
    });
  }

  try {
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await hashPassword(newPassword);

    // Mettre à jour le mot de passe
    await User.findByIdAndUpdate(id, { password: hashedNewPassword });

    res.status(200).json({ 
      message: `Mot de passe réinitialisé avec succès pour ${userToUpdate.firstName} ${userToUpdate.lastName}.`,
      user: formatUserResponse(userToUpdate)
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

// Obtenir les informations d'un utilisateur spécifique (admin seulement)
router.get('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const user = await findUserById(id, res);
    if (!user) return;

    res.status(200).json(user);
  } catch (err) {
    handleServerError(res, err);
  }
});

// Mettre à jour les informations d'un utilisateur (admin seulement)
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, login } = req.body;

  try {
    // Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
    if (email) {
      const existingUser = await checkEmailDuplicate(email, id);
      if (existingUser) {
        return res.status(400).json({ message: 'Email déjà utilisé par un autre utilisateur.' });
      }
    }

    // Vérifier si le login n'est pas déjà utilisé par un autre utilisateur
    if (login) {
      const existingUser = await checkLoginDuplicate(login, id);
      if (existingUser) {
        return res.status(400).json({ message: 'Login déjà utilisé par un autre utilisateur.' });
      }
    }

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (login !== undefined) updateData.login = login;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    res.status(200).json({ 
      message: 'Informations utilisateur mises à jour avec succès.', 
      user: updatedUser 
    });
  } catch (err) {
    handleServerError(res, err);
  }
});

module.exports = router;
