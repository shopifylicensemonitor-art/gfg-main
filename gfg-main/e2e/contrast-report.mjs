import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';

const base = process.env.BASE_URL || 'http://localhost:5173';
const pages = ['/', '/send', '/dashboard'];

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const results = {};
  for (const p of pages) {
    const page = await ctx.newPage();
    const url = base + p;
    console.log(`Scanning ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    const report = await new AxeBuilder({ page }).analyze();
    const contrast = (report.violations || []).filter(v => v.id === 'color-contrast');
    results[p] = contrast.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      nodes: v.nodes.map(n => ({
        target: n.target,
        html: n.html,
        failureSummary: n.failureSummary
      }))
    }));
    await page.close();
  }
  await browser.close();
  fs.writeFileSync('e2e/contrast-report.json', JSON.stringify(results, null, 2));
  console.log('Contrast report written to e2e/contrast-report.json');
}

run().catch(err => { console.error(err); process.exit(1); });
