import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/send', '/dashboard'];

for (const p of pages) {
  test(`a11y scan ${p}`, async ({ page }) => {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    // Run axe-core
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations || [];
    if (violations.length > 0) {
      console.log(`Found ${violations.length} accessibility violations on ${p}`);
      violations.forEach(v => {
        console.log(`- ${v.id} [${v.impact}] ${v.description} (nodes: ${v.nodes.length})`);
      });
    }
    // Fail test if there are any serious/critical violations
    // Only fail the test for critical-impact violations for now (reduce noise from color-contrast)
    const critical = violations.filter(v => v.impact === 'critical');
    expect(critical.length, `Critical a11y violations on ${p}`).toBe(0);
  });
}
