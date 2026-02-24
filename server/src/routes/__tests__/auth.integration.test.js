/**
 * Auth API Integration Tests
 * Tests for authentication endpoints
 */

import request from 'supertest';
import app from '../../../index';

describe('Auth API Integration Tests', () => {
  const testUser = {
    email: 'testuser@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
    householdName: 'Test Household'
  };

  let accessToken;
  let refreshToken;

  describe('POST /auth/register', () => {
    it('should successfully register a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.expiresIn).toBe(900);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          ...testUser,
          password: 'weak'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      await request(app).post('/auth/register').send(testUser);

      const res = await request(app)
        .post('/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      await request(app).post('/auth/register').send(testUser);
    });

    it('should successfully login', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });

    it('should reject incorrect password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          password: testUser.password
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/refresh', () => {
    beforeAll(async () => {
      const registerRes = await request(app).post('/auth/register').send(testUser);
      refreshToken = registerRes.body.refreshToken;
    });

    it('should successfully refresh tokens', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.expiresIn).toBe(900);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid.token.jwt' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/logout', () => {
    beforeAll(async () => {
      const registerRes = await request(app).post('/auth/register').send(testUser);
      accessToken = registerRes.body.accessToken;
    });

    it('should successfully logout', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successfully');
    });

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/auth/logout');

      expect(res.status).toBe(400);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid.token');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    beforeAll(async () => {
      const registerRes = await request(app).post('/auth/register').send(testUser);
      accessToken = registerRes.body.accessToken;
    });

    it('should return current user info', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token');

      expect(res.status).toBe(401);
    });
  });
});

describe('Rate Limiting Middleware', () => {
  it('should allow normal requests', async () => {
    const res = await request(app)
      .get('/auth/me');

    // Without token is 401, but not rate limited
    expect(res.status).not.toBe(429);
  });

  it('should return rate limit headers', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test' });

    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});

describe('Validation Middleware', () => {
  it('should return detailed validation errors', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'invalid',
        password: 'weak',
        name: 'A',
        householdName: ''
      });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

describe('Error Handling', () => {
  it('should handle server errors gracefully', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: 'Test User',
        householdName: 'Test Household'
      });

    // Should return either success or validation error, not 500
    expect([201, 400, 409]).toContain(res.status);
  });
});
