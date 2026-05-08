const { test, expect } = require('@playwright/test');

test('homepage loads', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/EduSYNC Home/);
  await expect(page.locator('body')).toContainText('OK');
});
