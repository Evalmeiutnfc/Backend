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

describe('Routes d\'authentification', () => {
  it('Inscription d\'un nouvel utilisateur', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      login: 'johndoe',
      password: 'password123',
      role: 'professor',
    });
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Utilisateur créé avec succès.');
  });

  it('Connexion avec un utilisateur existant', async () => {
    const response = await request(app).post('/api/auth/login').send({
      login: 'johndoe',
      password: 'password123',
    });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
