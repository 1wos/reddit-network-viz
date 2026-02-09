import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';

const FRAMES_DIR = './frames';
const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;

async function clickButton(page, textMatch) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes(textMatch)) {
      await btn.click();
      return true;
    }
  }
  return false;
}

async function frames(page, start, count, delay) {
  for (let i = start; i < start + count; i++) {
    await page.screenshot({ path: `${FRAMES_DIR}/frame_${String(i).padStart(4, '0')}.png` });
    await new Promise(r => setTimeout(r, delay || 1000 / FPS));
  }
  return start + count;
}

async function captureDemoGif(theme, filename) {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: WIDTH, height: HEIGHT },
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.waitForSelector('svg', { timeout: 10000 });

  // Toggle Claude API mode on (shows ⚡ CLAUDE API)
  await clickButton(page, 'MOCK DATA');
  await new Promise(r => setTimeout(r, 300));

  // Switch theme if light
  if (theme === 'light') {
    await clickButton(page, 'LIGHT');
    await new Promise(r => setTimeout(r, 300));
  }

  // Hit Refresh to reload data with API badge visible
  await clickButton(page, 'Refresh');
  await new Promise(r => setTimeout(r, 3500));

  rmSync(FRAMES_DIR, { recursive: true, force: true });
  mkdirSync(FRAMES_DIR, { recursive: true });
  let f = 0;

  console.log(`[${theme}] Scene 1: Overview with speech bubbles...`);
  f = await frames(page, f, 25, 80);

  // Scene 2: Hover nodes to show connections
  console.log(`[${theme}] Scene 2: Hover interactions...`);
  const svgBox = await page.$eval('svg', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });

  // Hover across several areas
  for (const [px, py] of [[0.35, 0.35], [0.5, 0.45], [0.4, 0.55]]) {
    await page.mouse.move(svgBox.x + svgBox.w * px, svgBox.y + svgBox.h * py);
    await new Promise(r => setTimeout(r, 300));
    f = await frames(page, f, 8, 80);
  }

  // Scene 3: Click a node — shows trend chart in sidebar
  console.log(`[${theme}] Scene 3: Click node → trend chart...`);
  await page.mouse.click(svgBox.x + svgBox.w * 0.4, svgBox.y + svgBox.h * 0.45);
  await new Promise(r => setTimeout(r, 800));
  f = await frames(page, f, 20, 80);

  // Scene 4: Switch subreddit
  console.log(`[${theme}] Scene 4: Switch to r/worldnews...`);
  await clickButton(page, 'r/worldnews');
  await new Promise(r => setTimeout(r, 500));
  f = await frames(page, f, 8, 80);  // loading spinner
  await new Promise(r => setTimeout(r, 2500));
  f = await frames(page, f, 20, 80);  // new graph

  // Scene 5: Click another node in worldnews
  console.log(`[${theme}] Scene 5: Click worldnews node...`);
  await page.mouse.click(svgBox.x + svgBox.w * 0.45, svgBox.y + svgBox.h * 0.4);
  await new Promise(r => setTimeout(r, 600));
  f = await frames(page, f, 15, 80);

  // Scene 6: Switch to r/gaming
  console.log(`[${theme}] Scene 6: Switch to r/gaming...`);
  await clickButton(page, 'r/gaming');
  await new Promise(r => setTimeout(r, 3200));
  f = await frames(page, f, 18, 80);

  await browser.close();

  // Convert to GIF — higher quality
  console.log(`Converting ${f} frames to ${filename}...`);
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${FRAMES_DIR}/frame_%04d.png ` +
    `-vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" ` +
    `${filename}`,
    { stdio: 'inherit' }
  );
  console.log(`Done: ${filename} (${f} frames)`);

  rmSync(FRAMES_DIR, { recursive: true, force: true });
}

async function main() {
  await captureDemoGif('dark', 'demo-dark.gif');
  await captureDemoGif('light', 'demo-light.gif');
  console.log('\nAll demo GIFs created!');
}

main().catch(console.error);
