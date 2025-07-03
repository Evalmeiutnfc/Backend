const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const Form = require('../models/Form');
const Evaluation = require('../models/Evaluation');

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

describe('Routes des évaluations', () => {
  let formId;

  beforeAll(async () => {
    // Création d'un formulaire de test
    const form = new Form({
      title: 'Test Form',
      professor: new mongoose.Types.ObjectId(),
      associationType: 'student',
      validFrom: new Date(),
      validTo: new Date(),
      sections: [
        {
          title: 'Section 1',
          lines: [
            { title: 'Criterion 1', maxScore: 8, type: 'scale' },
            { title: 'Criterion 2', maxScore: 1, type: 'binary' },
          ],
        },
      ],
    });
    const savedForm = await form.save();
    formId = savedForm._id;
  });

  it('doit créer une évaluation', async () => {
    const response = await request(app)
      .post('/api/evaluations/create')
      .send({
        formId,
        evaluatorId: new mongoose.Types.ObjectId(),
        studentId: new mongoose.Types.ObjectId(),
        groupNumber: 0,
        scores: [
          { lineId: new mongoose.Types.ObjectId(), score: 5 },
          { lineId: new mongoose.Types.ObjectId(), score: 1 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Évaluation créée avec succès.');
  });

  it('doit mettre à jour une évaluation', async () => {
    const evaluation = new Evaluation({
      form: formId,
      evaluator: new mongoose.Types.ObjectId(),
      student: new mongoose.Types.ObjectId(),
      groupNumber: 0,
      scores: [
        { lineId: new mongoose.Types.ObjectId(), score: 5 },
        { lineId: new mongoose.Types.ObjectId(), score: 1 },
      ],
    });
    const savedEvaluation = await evaluation.save();

    const response = await request(app)
      .put(`/api/evaluations/update/${savedEvaluation._id}`)
      .send({
        scores: [
          { lineId: new mongoose.Types.ObjectId(), score: 8 },
          { lineId: new mongoose.Types.ObjectId(), score: 0 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Évaluation mise à jour avec succès.');
  });

  it('doit exporter les évaluations au format CSV', async () => {
    const response = await request(app).get(`/api/evaluations/export/${formId}`);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('text/csv');
  });
});
