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

describe('Routes des étudiants', () => {
  it('Ajout d\'un nouvel étudiant', async () => {
    const response = await request(app).post('/api/students/add').send({
      firstName: 'Jane',
      lastName: 'Doe',
      year: 'BUT3',
      group: 'TD1',
    });
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Étudiant ajouté avec succès.');
  });

  it('Liste des étudiants avec filtres', async () => {
    const response = await request(app).get('/api/students/list').query({ year: 'BUT3', group: 'TD1' });
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });

  it('Modification d\'un étudiant', async () => {
    const studentId = 'id_étudiant_test'; // Remplacez par un ID valide
    const response = await request(app).put(`/api/students/update/${studentId}`).send({
      firstName: 'Jane',
      lastName: 'Smith',
      year: 'BUT3',
      group: 'TD2',
    });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Étudiant mis à jour avec succès.');
  });

  it('Suppression d\'un étudiant', async () => {
    const studentId = 'id_étudiant_test'; // Remplacez par un ID valide
    const response = await request(app).delete(`/api/students/delete/${studentId}`);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Étudiant supprimé avec succès.');
  });
});
