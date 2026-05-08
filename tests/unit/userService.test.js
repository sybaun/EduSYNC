const { createUser } = require('../../src/services/userService');

test('should create user with valid email', () => {
  const user = createUser('test@mail.com');

  expect(user).toHaveProperty('email', 'test@mail.com');
  expect(user).toHaveProperty('id');
});