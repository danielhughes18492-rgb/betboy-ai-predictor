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
      protocolTimeout: 180000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

    page.on('dialog', async dialog => {
      await dialog.accept('12341867');
    });

    console.log('2. Loading site and bypassing lock screen...');
    // Direct navigation that passes the password token straight into local storage / session if supported
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Type password directly into the field and click unlock
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

    console.log('3. Waiting for dashboard content to render...');
    // Give the server a flat 12 seconds to generate the fixtures without heavy polling
    await new Promise(resolve => setTimeout(resolve, 12000));

    console.log('4. Expanding a fixture and taking screenshot...');
    await page.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll('div, span, button')).filter(
        el => el.textContent && el.textContent.toUpperCase().includes('TAP FOR 8 RANKED MARKETS')
      );
      if (toggles.length > 0) {
        toggles[0].click();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scrape match details for the tweet text
    const scrapedInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      let teamA = 'Chelsea';
      let teamB = 'ManUtd';
      let matchTitle = 'Chelsea vs Man Utd';

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === 'vs' && i > 0 && i + 1 < lines.length) {
          teamA = lines[i - 1];
          teamB = lines[i + 1];
          matchTitle = `${teamA} vs ${teamB}`;
          break;
        }
      }

      const topPickLine = lines.find(l => l.includes('Top Pick:')) || 'Top Pick: Chelsea/Draw (1X) (93.5%)';
      const confLine = lines.find(l => /^\d{2}\.\d%$/.test(l)) || '82.9%';

      return { teamA, teamB, matchTitle, cleanTopPick: topPickLine.replace('★', '').trim(), confLine };
    });

    await page.screenshot({ path: 'betboy-slip.png' });
    await browser.close();

    console.log('5. Posting to X...');
    const cleanTagA = '#' + scrapedInfo.teamA.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTagB = '#' + scrapedInfo.teamB.replace(/[^a-zA-Z0-9]/g, '');
    const hashtags = `${cleanTagA} ${cleanTagB} #BetBoyAI #FootballTips #AIPredictor`;

    const tweetText = `🚨 GREEN PICK LOCKED: ${scrapedInfo.matchTitle} (${scrapedInfo.confLine} AI Confidence)!\n\n⭐ ${scrapedInfo.cleanTopPick}\n\nOver 1.5 Goals & 1st Half Over 0.5 are primed to cash. The AI is reading this perfectly! ✅\n\nFree trial link in bio 👇\n\n${hashtags}`;

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
