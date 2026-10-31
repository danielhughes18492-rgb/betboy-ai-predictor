const puppeteer = require('puppeteer');
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function runAutomation() {
  let browser;
  try {
    console.log('1. Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      protocolTimeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

    page.on('dialog', async dialog => {
      await dialog.accept('12341867');
    });

    console.log('2. Loading site and entering password...');
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(inp => {
        inp.value = '12341867';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
      
      const buttons = Array.from(document.querySelectorAll('button, a, div'));
      const unlockBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Unlock Access');
      if (unlockBtn) unlockBtn.click();
    });

    console.log('3. Waiting for dashboard to render...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('4. Expanding first fixture...');
    await page.evaluate(() => {
      // Click the first element containing market text or dropdown arrow
      const elements = Array.from(document.querySelectorAll('*'));
      const target = elements.find(el => el.children.length === 0 && el.textContent && el.textContent.includes('RANKED MARKETS'));
      if (target) {
        target.click();
      } else if (elements.length > 0) {
        // Fallback: click the first match card header
        const card = document.querySelector('div.rounded-2xl, div[class*="bg-"]');
        if (card) card.click();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('5. Taking screenshot...');
    await page.screenshot({ path: 'betboy-slip.png' });
    await browser.close();

    console.log('6. Posting to X...');
    const tweetText = `🚨 GREEN PICK LOCKED: Chelsea vs Man Utd (82.9% AI Confidence)!\n\n⭐ Top Pick: Chelsea/Draw (1X) (93.5%)\n\nOver 1.5 Goals (90.6%) & 1st Half Over 0.5 (80.1%) are primed to cash. The AI is reading this perfectly! ✅\n\nFree trial link in bio 👇\n\n#Chelsea #ManUtd #BetBoyAI #FootballTips #AIPredictor`;

    const mediaId = await client.v1.uploadMedia('./betboy-slip.png');
    await client.v2.tweet({
      text: tweetText,
      media: { media_ids: [mediaId] }
    });

    console.log('Tweet posted successfully!');
  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runAutomation();
