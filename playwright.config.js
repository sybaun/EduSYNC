module.exports = {
  testDir: './e2e',
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000'
  },

  webServer: {
    command: 'node src/server.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
};
