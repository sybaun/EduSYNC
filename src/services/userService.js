function createUser(email) {
  return {
    id: Date.now(),
    email
  };
}

module.exports = { createUser };