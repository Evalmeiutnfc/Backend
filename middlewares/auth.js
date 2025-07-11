const jwt = require('jsonwebtoken');

// Middleware d'authentification
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide.' });
  }
}

// Alias pour compatibilité
const verifyToken = authenticate;

// Middleware pour vérifier les droits administrateur
function requireAdmin(req, res, next) {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }
    next();
  });
}

// Middleware pour vérifier les droits professeur
function requireProfessor(req, res, next) {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    if (!req.user || req.user.role !== 'professor') {
      return res.status(403).json({ message: 'Accès refusé. Droits professeur requis.' });
    }
    next();
  });
}

// Middleware pour vérifier les droits professeur ou administrateur
function requireProfessorOrAdmin(req, res, next) {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    if (!req.user || !['professor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé. Droits professeur ou administrateur requis.' });
    }
    next();
  });
}

module.exports = { authenticate, verifyToken, requireAdmin, requireProfessor, requireProfessorOrAdmin };
