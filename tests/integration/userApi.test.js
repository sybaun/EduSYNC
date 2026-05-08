const request = require('supertest');
const app = require('../../src/app');

test('POST /user creates user', async () => {
  const res = await request(app)
    .post('/user')
    .send({ email: 'test@mail.com' });

  expect(res.statusCode).toBe(201);
  expect(res.body.email).toBe('test@mail.com');
});