const User = require('../models/User');

// Middleware pour vérifier les droits administrateur
const requireAdmin = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Accès non autorisé. Droits administrateur requis.' });
    }
    req.currentUser = currentUser;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
};

// Middleware pour empêcher l'auto-modification
const preventSelfModification = (req, res, next) => {
  const { id } = req.params;
  if (req.user.id === id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas modifier votre propre compte.' });
  }
  next();
};

module.exports = {
  requireAdmin,
  preventSelfModification
};
