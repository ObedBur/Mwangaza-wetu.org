import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

// Les tests nécessitent une base PostgreSQL locale (voir `.env.test.example`).
// Sans elle, ils sont explicitement ignorés plutôt que d'écrire dans la base
// distante configurée par `backend/.env`.
const describeE2E = process.env.E2E_SKIP === '1' ? describe.skip : describe;

describeE2E('Sécurité HTTP (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // Même configuration que la production (proxy, headers, pipes, CORS).
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sert la racine de l’API', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(typeof response.text).toBe('string');
  });

  it('interdit le cache des réponses d’authentification', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/csrf-token')
      .expect(200);

    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['pragma']).toBe('no-cache');
    // Le middleware de sécurité doit s'appliquer aussi à l'API.
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('refuse un mot de passe d’activation trop court (DTO validé)', async () => {
    await request(app.getHttpServer())
      .post('/api/membres/activate')
      .send({ token: 'a'.repeat(32), motDePasse: 'court' })
      .expect(400);
  });

  it('refuse un corps d’activation non conforme (champ inconnu)', async () => {
    await request(app.getHttpServer())
      .post('/api/membres/activate')
      .send({
        token: 'a'.repeat(32),
        motDePasse: 'motdepasse-solide',
        role: 'superadmin',
      })
      .expect(400);
  });

  it('protège le déverrouillage de compte derrière l’authentification', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/unlock')
      .send({ role: 'member', id: 1 })
      .expect(401);
  });

  it('n’expose pas le hash de mot de passe via PUT /api/membres/:id', async () => {
    // Sans session, la route est refusée avant toute lecture en base.
    await request(app.getHttpServer())
      .put('/api/membres/1')
      .send({ motDePasse: 'motdepasse-solide' })
      .expect(401);
  });
});
