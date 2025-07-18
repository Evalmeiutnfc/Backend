const bcrypt = require('bcrypt');
const User = require('../models/User');

// Fonction utilitaire pour gérer les erreurs serveur
const handleServerError = (res, err) => {
  res.status(500).json({ message: 'Erreur serveur.', error: err.message });
};

// Fonction utilitaire pour vérifier l'existence d'un utilisateur
const findUserById = async (id, res) => {
  const user = await User.findById(id).select('-password');
  if (!user) {
    res.status(404).json({ message: 'Utilisateur non trouvé.' });
    return null;
  }
  return user;
};

// Fonction utilitaire pour valider les rôles
const validateRole = (role) => {
  return role && ['admin', 'professor'].includes(role);
};

// Fonction utilitaire pour vérifier les doublons d'email
const checkEmailDuplicate = async (email, excludeId = null) => {
  if (!email) return null;
  
  const query = { email };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return await User.findOne(query);
};

// Fonction utilitaire pour vérifier les doublons de login
const checkLoginDuplicate = async (login, excludeId = null) => {
  if (!login) return null;
  
  const query = { login };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return await User.findOne(query);
};

// Fonction utilitaire pour hasher un mot de passe
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Fonction utilitaire pour valider la longueur du mot de passe
const validatePasswordLength = (password, minLength = 6) => {
  return password && password.length >= minLength;
};

// Fonction utilitaire pour formater les informations utilisateur (sans mot de passe)
const formatUserResponse = (user) => {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    login: user.login,
    role: user.role
  };
};

module.exports = {
  handleServerError,
  findUserById,
  validateRole,
  checkEmailDuplicate,
  checkLoginDuplicate,
  hashPassword,
  validatePasswordLength,
  formatUserResponse
};
