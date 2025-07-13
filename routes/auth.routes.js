const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// Inscription
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, login, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email déjà utilisé.' });
    }

    const user = new User({ firstName, lastName, email, login, password, role });
    await user.save();
    res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
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
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Récupérer le profil utilisateur connecté
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Mettre à jour le profil utilisateur
router.put('/profile', authenticate, async (req, res) => {
  const { firstName, lastName, email } = req.body;
  try {
    // Vérifier si l'email n'est pas déjà utilisé par un autre utilisateur
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
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
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
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
  if (newPassword.length < 6) {
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
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe
    await User.findByIdAndUpdate(req.user.id, { password: hashedNewPassword });

    res.status(200).json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
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
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Lister tous les utilisateurs (admin seulement)
router.get('/users', authenticate, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est admin
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé. Droits administrateur requis.' });
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Mettre à jour le rôle d'un utilisateur (admin seulement)
router.put('/users/:id/role', authenticate, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validation du rôle
  if (!role || !['admin', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide. Valeurs acceptées: admin, user.' });
  }

  try {
    // Vérifier si l'utilisateur est admin
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé. Droits administrateur requis.' });
    }

    // Empêcher un admin de modifier son propre rôle
    if (req.user.id === id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas modifier votre propre rôle.' });
    }

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
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Vérifier la validité du token
router.get('/verify-token', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.status(200).json({ 
      valid: true, 
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        login: user.login,
        role: user.role
      }
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
router.get('/users/professors', authenticate, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé. Droits administrateur requis.' });
    }

    const professors = await User.find({ role: 'professor' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json(professors);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// Récupérer les utilisateurs avec le rôle d'administrateur
router.get('/users/admins', authenticate, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé. Droits administrateur requis.' });
    }

    const admins = await User.find({ role: 'admin' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json(admins);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
