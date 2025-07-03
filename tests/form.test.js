const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

beforeAll(async () => {
  // Connexion à une base de données de test
  await mongoose.connect(process.env.MONGO_URI_TEST, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  // Déconnexion de la base de données
  await mongoose.disconnect();
});

describe('Routes des formulaires', () => {
  it('Ajout d\'un nouveau formulaire', async () => {
    const response = await request(app).post('/api/forms/add').send({
      professor: 'id_professeur_test', // Remplacez par un ID valide
      title: 'Formulaire Test',
      associationType: 'student',
      students: ['id_étudiant_test'], // Remplacez par des IDs valides
      sections: [
        {
          title: 'Section 1',
          lines: [
            { title: 'Critère 1', maxScore: 8, type: 'scale' },
            { title: 'Critère 2', maxScore: 1, type: 'binary' },
          ],
        },
      ],
      validity: { startDate: '2025-06-01', endDate: '2025-06-30' },
    });
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Formulaire créé avec succès.');
  });

  it('Liste des formulaires valides', async () => {
    const response = await request(app).get('/api/forms/list');
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });

  it('Modification d\'un formulaire', async () => {
    const formId = 'id_formulaire_test'; // Remplacez par un ID valide
    const response = await request(app).put(`/api/forms/update/${formId}`).send({
      title: 'Formulaire Modifié',
      validity: { startDate: '2025-06-01', endDate: '2025-07-01' },
    });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Formulaire mis à jour avec succès.');
  });

  it('Suppression d\'un formulaire', async () => {
    const formId = 'id_formulaire_test'; // Remplacez par un ID valide
    const response = await request(app).delete(`/api/forms/delete/${formId}`);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Formulaire supprimé avec succès.');
  });
});
