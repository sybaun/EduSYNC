module.exports = {
  use: {
    baseURL: 'http://localhost:3000'
  },
  webServer: {
    command: 'node src/server.js',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120 * 1000
  }
};