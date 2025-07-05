# 📋 Documentation Technique Backend - Evalme IUT NFC

## 🎯 Vue d'ensemble

API REST développée en **Node.js/Express** avec base de données **MongoDB** pour une application d'évaluation de soutenances et rapports étudiants.

**Base URL** : `http://localhost:5000/api`

---

## 🏗️ Architecture Technique

### Stack Technologique

- **Runtime** : Node.js
- **Framework** : Express.js 5.1.0
- **Base de données** : MongoDB avec Mongoose 8.16.1
- **Authentification** : JWT (jsonwebtoken 9.0.2)
- **Sécurité** : bcrypt 6.0.0 pour le hachage des mots de passe
- **CORS** : Configuré pour `http://localhost:5173` (frontend Vue.js)

### Structure du Projet

```text
backend/
├── app.js              # Configuration Express et routes principales
├── server.js           # Point d'entrée et connexion MongoDB
├── models/             # Modèles Mongoose
├── routes/             # Routes API REST
├── middlewares/        # Middleware d'authentification
└── tests/             # Tests unitaires
```

---

## 🗃️ Modèles de Données

### 1. User (Utilisateurs/Professeurs)

```javascript
{
  _id: ObjectId,
  firstName: String,      // Prénom
  lastName: String,       // Nom
  email: String,          // Email (unique)
  login: String,          // Login (unique)
  password: String,       // Mot de passe hashé
  role: String,           // "admin" | "user"
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Student (Étudiants)

```javascript
{
  _id: ObjectId,
  firstName: String,      // Prénom étudiant
  lastName: String,       // Nom étudiant
  year: String,           // "BUT1" | "BUT2" | "BUT3"
  group: String,          // Groupe TD
  studentNumber: String,  // Numéro étudiant (unique)
  isGroup: Boolean,       // Indique si c'est un groupe
  createdAt: Date,
  updatedAt: Date
}
```

### 3. Form (Formulaires d'évaluation)

```javascript
{
  _id: ObjectId,
  professor: ObjectId,           // Référence vers User
  title: String,                 // Titre du formulaire
  associationType: String,       // "student" | "group"
  students: [ObjectId],          // Références vers Student[]
  groupCount: Number,            // Nombre de groupes (si type group)
  sections: [{                   // Sections du formulaire
    title: String,               // Titre de la section
    lines: [{                    // Lignes de critères
      title: String,             // Critère d'évaluation
      maxScore: Number,          // Note maximale
      type: String               // "binary" | "scale"
    }]
  }],
  validFrom: Date,              // Date début validité
  validTo: Date,                // Date fin validité
  createdAt: Date,
  updatedAt: Date
}
```

**Types de notation** :

- `binary` : Oui/Non (0 ou 1)
- `scale` : Échelle graduée (0 à 8)

### 4. Evaluation (Évaluations réalisées)

```javascript
{
  _id: ObjectId,
  form: ObjectId,               // Référence vers Form
  professor: ObjectId,          // Référence vers User (évaluateur)
  student: ObjectId,            // Référence vers Student (optionnel)
  groupNumber: Number,          // Numéro de groupe (optionnel)
  scores: [{                    // Notes attribuées
    lineId: ObjectId,           // ID de la ligne de critère
    score: Number               // Note donnée
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🛣️ API Routes

### 🔐 Authentification (`/api/auth`)

#### POST `/api/auth/register`

Inscription d'un nouvel utilisateur

```javascript
// Request Body
{
  "firstName": "Jean",
  "lastName": "Dupont", 
  "email": "jean.dupont@iut.fr",
  "login": "jdupont",
  "password": "motdepasse123",
  "role": "user" // optionnel, "user" par défaut
}

// Response (201)
{
  "message": "Utilisateur créé avec succès."
}
```

#### POST `/api/auth/login`

Connexion utilisateur

```javascript
// Request Body
{
  "login": "jdupont",
  "password": "motdepasse123"
}

// Response (200)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "login": "jdupont",
    "role": "user"
  }
}
```

---

### 👨‍🎓 Étudiants (`/api/students`)

#### POST `/api/students/add`

Ajouter un étudiant

```javascript
// Request Body
{
  "firstName": "Marie",
  "lastName": "Martin",
  "year": "BUT2",
  "group": "TD1",
  "studentNumber": "20230001"
}

// Response (201)
{
  "message": "Étudiant ajouté avec succès.",
  "student": { /* objet étudiant */ }
}
```

#### GET `/api/students/list`

Lister les étudiants avec filtres optionnels

```javascript
// Query Parameters (optionnels)
?year=BUT2&group=TD1

// Response (200)
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "firstName": "Marie",
    "lastName": "Martin",
    "year": "BUT2",
    "group": "TD1",
    "studentNumber": "20230001",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### PUT `/api/students/update/:id`

Modifier un étudiant

```javascript
// Request Body (champs à modifier)
{
  "firstName": "Marie-Claire",
  "group": "TD2"
}
```

#### DELETE `/api/students/delete/:id`

Supprimer un étudiant

---

### 📋 Formulaires (`/api/forms`)

**🔒 Routes protégées - Token JWT requis**

#### POST `/api/forms/add`

Créer un formulaire d'évaluation

```javascript
// Headers
Authorization: Bearer <token>

// Request Body
{
  "professor": "60f7b3b3b3b3b3b3b3b3b3b3",
  "title": "Évaluation Soutenance Projet",
  "associationType": "student",
  "students": ["60f7b3b3b3b3b3b3b3b3b3b3"],
  "groupCount": 0,
  "sections": [
    {
      "title": "Présentation",
      "lines": [
        {
          "title": "Qualité de l'expression orale",
          "maxScore": 8,
          "type": "scale"
        },
        {
          "title": "Respect du temps imparti",
          "maxScore": 1,
          "type": "binary"
        }
      ]
    }
  ],
  "validFrom": "2024-01-15T00:00:00.000Z",
  "validTo": "2024-02-15T23:59:59.000Z"
}
```

#### GET `/api/forms/list`

Lister les formulaires actuellement valides

```javascript
// Headers
Authorization: Bearer <token>

// Response (200)
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "title": "Évaluation Soutenance Projet",
    "associationType": "student",
    "validFrom": "2024-01-15T00:00:00.000Z",
    "validTo": "2024-02-15T23:59:59.000Z",
    "sections": [ /* sections complètes */ ]
  }
]
```

#### PUT `/api/forms/update/:id`

Modifier un formulaire

#### DELETE `/api/forms/delete/:id`

Supprimer un formulaire

---

### 📊 Évaluations (`/api/evaluations`)

#### POST `/api/evaluations/create`

Créer une évaluation

```javascript
// Request Body
{
  "formId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "evaluatorId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "studentId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "groupNumber": 0,
  "scores": [
    {
      "lineId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "score": 6
    },
    {
      "lineId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "score": 1
    }
  ]
}
```

#### PUT `/api/evaluations/update/:id`

Modifier une évaluation existante

```javascript
// Request Body
{
  "scores": [
    {
      "lineId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "score": 7
    }
  ]
}
```

#### GET `/api/evaluations/export/:formId`

Exporter les évaluations en CSV

```javascript
// Response (200)
Content-Type: text/csv
Content-Disposition: attachment; filename="Evaluation-Soutenance-Projet-evaluations.csv"

// Contenu CSV
8,1
Marie,Martin,75,100
Jean,Dupont,87.5,100
```

---

## 🔐 Authentification Frontend

### Utilisation du Token JWT

```javascript
// Stockage après connexion
localStorage.setItem('token', response.data.token);

// Utilisation dans les requêtes
const config = {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
};

axios.get('/api/forms/list', config);
```

### Middleware d'authentification

Les routes protégées retournent `401 Unauthorized` si :

- Token manquant
- Token invalide ou expiré

---

## 📊 Format Export CSV

### Structure du fichier CSV

```csv
8,1,6,8                    # Ligne 1: Notes maximales de chaque critère
Marie,Martin,75,100,50,87.5    # Étudiants avec pourcentages de réussite
Jean,Dupont,87.5,100,75,100
```

### Calcul des pourcentages

- **Type `binary`** : `non = 0%`, `oui = 100%`
- **Type `scale`** : `niveau 0 = 0%`, `niveau 1 = 12.5%`, ..., `niveau 8 = 100%`
- **Moyenne** si plusieurs évaluateurs pour le même critère

---

## 🚀 Démarrage du Backend

```bash
# Installation des dépendances
npm install

# Variables d'environnement (.env)
PORT=5000
MONGO_URI=mongodb://localhost:27017/evalme_iut
JWT_SECRET=votre_secret_jwt_tres_securise

# Démarrage en développement
npm run dev
```

---

## 🛠️ Points d'Attention pour le Frontend

1. **CORS** : Backend configuré pour `http://localhost:5173`
2. **Authentification** : Token JWT obligatoire pour routes `/forms` et partiellement `/evaluations`
3. **Validation** : Le backend valide les données, gérer les erreurs côté frontend
4. **Dates** : Format ISO 8601 pour `validFrom` et `validTo`
5. **Association exclusive** : Un formulaire ne peut être associé qu'à des étudiants OU des groupes
6. **Export CSV** : Téléchargement direct via navigateur avec `Content-Disposition`

---

## 📝 Codes d'erreur fréquents

- `400` : Données invalides ou manquantes
- `401` : Non authentifié (token manquant/invalide)
- `404` : Ressource non trouvée
- `500` : Erreur serveur

---

*Documentation générée le 4 juillet 2025 - Version Backend 1.0.0*
