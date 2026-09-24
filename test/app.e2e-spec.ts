import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  let adminToken: string;
  let userToken: string;
  let userRefreshToken: string;
  let createdUserId: number;
  let adminUserId: number;

  const adminCreds = {
    email: 'admin@test.local',
    password: 'admin123',
  };

  const uniqueSuffix = `${Date.now()}`;
  const testUser = {
    name: 'E2E Test User',
    email: `e2e-${uniqueSuffix}@example.com`,
    password: 'secret123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('/ (GET) should be public', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('Auth (e2e)', () => {
    it('POST /auth/register - should register a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      createdUserId = res.body.id;
      expect(res.body.email).toBe(testUser.email);
      expect(res.body.password).toBeUndefined();
      expect(res.body.role).toBe('user');
    });

    it('POST /auth/register - should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('POST /auth/login - should return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      userToken = res.body.access_token;
      userRefreshToken = res.body.refresh_token;
    });

    it('POST /auth/login - admin should login', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(adminCreds)
        .expect(200);

      adminToken = res.body.access_token;
      expect(adminToken).toBeTruthy();

      const decoded = JSON.parse(
        Buffer.from(adminToken.split('.')[1], 'base64').toString(),
      );
      adminUserId = decoded.sub;
      expect(decoded.role).toBe('admin');
    });

    it('POST /auth/login - should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpass' })
        .expect(401);
    });

    it('POST /auth/login - should lock account after 5 failed attempts', async () => {
      const lockUser = {
        name: 'Lock Test',
        email: `lock-${uniqueSuffix}@example.com`,
        password: 'secret123',
      };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(lockUser)
        .expect(201);

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: lockUser.email, password: 'wrongpass' });
        if (i < 4) {
          expect(res.status).toBe(401);
        } else {
          expect(res.status).toBe(403);
        }
      }

      const lockedRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: lockUser.email, password: lockUser.password });
      expect(lockedRes.status).toBe(403);
      expect(lockedRes.body.message).toContain('terkunci');
    });

    it('POST /auth/refresh - should rotate tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: userRefreshToken })
        .expect(200);

      expect(res.body.access_token).toBeTruthy();
      expect(res.body.refresh_token).toBeTruthy();
      expect(res.body.refresh_token).not.toBe(userRefreshToken);
      userRefreshToken = res.body.refresh_token;
      userToken = res.body.access_token;
    });

    it('POST /auth/refresh - old token should be rejected after rotation', async () => {
      // userRefreshToken was already rotated in previous test; we need the ORIGINAL token.
      // Re-login to get a fresh pair, then rotate and try old one.
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);
      const originalRefresh = loginRes.body.refresh_token;

      const rotateRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: originalRefresh })
        .expect(200);
      userRefreshToken = rotateRes.body.refresh_token;
      userToken = rotateRes.body.access_token;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: originalRefresh })
        .expect(401);
    });

    it('POST /auth/refresh - should reject access token used as refresh', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: userToken })
        .expect(401);
    });

    it('POST /auth/logout - should require auth', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('POST /auth/logout - should succeed with token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(res.body.message).toBe('Berhasil logout');
    });

    it('POST /auth/forgot-password - should return generic message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);
      expect(res.body.message).toContain('Jika email terdaftar');
    });

    it('POST /auth/forgot-password - non-existent email same response', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);
      expect(res.body.message).toContain('Jika email terdaftar');
    });

    it('POST /auth/reset-password - should reject invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalidtoken', password: 'newpass123' })
        .expect(400);
    });

    it('POST /auth/reset-password - should reset with valid token', async () => {
      const resetUser = {
        name: 'Reset Test',
        email: `reset-${uniqueSuffix}@example.com`,
        password: 'secret123',
      };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(resetUser)
        .expect(201);

      // Capture token from MailService logger via app container
      const { MailService } = await import('./../src/mail/mail.service.js');
      const mailService = app.get(MailService);
      const sendSpy = vi
        .spyOn(mailService, 'sendPasswordReset')
        .mockImplementation(() => {});

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: resetUser.email })
        .expect(200);

      expect(sendSpy).toHaveBeenCalled();
      const capturedToken = sendSpy.mock.calls[0][1];

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: capturedToken, password: 'newpassword123' })
        .expect(200);

      // Login with new password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: resetUser.email, password: 'newpassword123' })
        .expect(200);

      sendSpy.mockRestore();
    });
  });

  describe('Users CRUD RBAC (e2e)', () => {
    it('GET /users - should reject unauthenticated', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('GET /users - should reject non-admin', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);
      userToken = loginRes.body.access_token;

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /users - admin should list users', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].password).toBeUndefined();
    });

    it('POST /users - admin should create user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Created',
          email: `admin-created-${uniqueSuffix}@example.com`,
          password: 'secret123',
        })
        .expect(201);

      expect(res.body.email).toBe(`admin-created-${uniqueSuffix}@example.com`);
      expect(res.body.password).toBeUndefined();
    });

    it('POST /users - non-admin forbidden', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'X',
          email: `x-${uniqueSuffix}@example.com`,
          password: 'secret123',
        })
        .expect(403);
    });

    it('GET /users/:id - authenticated user can view', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdUserId);
      expect(res.body.password).toBeUndefined();
    });

    it('GET /users/:id - unauthenticated rejected', async () => {
      await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .expect(401);
    });

    it('GET /users/:id - 404 if not found', async () => {
      await request(app.getHttpServer())
        .get('/users/999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('PATCH /users/:id - user can update self', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
      expect(res.body.password).toBeUndefined();
    });

    it('PATCH /users/:id - user cannot update another user', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${adminUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('PATCH /users/:id - admin can update another user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Updated' })
        .expect(200);
      expect(res.body.name).toBe('Admin Updated');
    });

    it('DELETE /users/:id - non-admin forbidden', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('DELETE /users/:id - admin should delete', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.message).toBe('User berhasil dihapus');
    });

    it('GET /users/:id - 404 after deletion', async () => {
      await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('POST /users - validation rejects bad input', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});
