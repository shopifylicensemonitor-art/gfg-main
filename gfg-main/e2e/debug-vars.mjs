import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
  const vars = await page.evaluate(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      muted: style.getPropertyValue('--muted-foreground').trim(),
      success: style.getPropertyValue('--success').trim(),
      bodyColor: getComputedStyle(document.body).color,
    };
  });
  console.log(vars);
  await browser.close();
})();
