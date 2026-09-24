const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const base = 'E:/infosys/public/screenshots';

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: base + '/login.png', fullPage: true });

  await page.locator('.role-option').filter({ hasText: 'Manager' }).click();
  await page.getByRole('button', { name: /Continue as Manager/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Your team at a glance'));
  await page.screenshot({ path: base + '/manager-dashboard.png', fullPage: true });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.locator('.role-option').filter({ hasText: 'HR Administrator' }).click();
  await page.getByRole('button', { name: /Continue as HR Administrator/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Good morning, Alex'));
  await page.screenshot({ path: base + '/hr-dashboard.png', fullPage: true });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.locator('.role-option').filter({ hasText: 'Employee' }).click();
  await page.getByRole('button', { name: /Continue as Employee/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Good morning, Alex'));
  await page.screenshot({ path: base + '/employee-portal.png', fullPage: true });

  await browser.close();
  console.log('screenshots saved');
})().catch((err) => { console.error(err); process.exit(1); });
