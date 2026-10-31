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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

    // Prevent any browser alert/prompt from freezing the script
    page.on('dialog', async dialog => {
      console.log('Auto-dismissing dialog:', dialog.message());
      await dialog.accept('12341867');
    });

    await page.evaluateOnNewDocument(() => {
      window.alert = msg => console.log('Alert:', msg);
      window.confirm = () => true;
    });

    console.log('2. Loading betboyai.co.uk...');
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('3. Entering password and clicking Unlock Access...');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passInput = inputs.find(i => i.offsetParent !== null) || inputs[0];
      if (passInput) {
        passInput.focus();
        passInput.value = '12341867';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const clickable = Array.from(document.querySelectorAll('button, a, div, span'));
      const unlockBtn = clickable.reverse().find(
        el => el.textContent && el.textContent.trim() === 'Unlock Access'
      );
      if (unlockBtn) unlockBtn.click();
    });

    console.log('4. Waiting for Green Picks to load...');
    let marketCount = 0;
    for (let attempt = 1; attempt <= 10; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      marketCount = await page.evaluate(() => {
        const nodes = document.querySelectorAll('div, span, button, p');
        let count = 0;
        for (const el of nodes) {
          const txt = el.textContent;
          if (txt && txt.length < 45 && txt.toUpperCase().includes('TAP FOR 8 RANKED MARKETS')) {
            count++;
            if (count >= 3) break;
          }
        }
        return count;
      });
      console.log(`Check ${attempt}: found ${marketCount} top fixtures...`);
      if (marketCount > 0) break;
    }

    console.log('5. Expanding a top Green Pick card and reading stats...');
    const scrapedInfo = await page.evaluate(() => {
      const nodes = document.querySelectorAll('div, span, button, p');
      const toggles = [];
      for (const el of nodes) {
        const txt = el.textContent;
        if (txt && txt.length < 45 && txt.toUpperCase().includes('TAP FOR 8 RANKED MARKETS')) {
          // Ensure we only grab the innermost toggle element
          const hasChildMatch = Array.from(el.children).some(
            c => c.textContent && c.textContent.toUpperCase().includes('TAP FOR 8 RANKED MARKETS')
          );
          if (!hasChildMatch) {
            toggles.push(el);
            if (toggles.length >= 3) break;
          }
        }
      }

      let card = null;
      if (toggles.length > 0) {
        const chosenToggle = toggles[Math.floor(Math.random() * toggles.length)];
        chosenToggle.click();

        // Walk up a few parent levels to grab just this single match card
        let el = chosenToggle.parentElement;
        for (let i = 0; i < 6 && el && el !== document.body; i++) {
          if (el.textContent && el.textContent.includes(' vs ')) {
            card = el;
            if (el.clientHeight > 250) break;
          }
          el = el.parentElement;
        }
      }

      if (card) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
      }

      const rawText = card ? card.innerText : '';
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

      let teamA = 'Football';
      let teamB = 'EFL';
      let matchTitle = "Today's Featured Fixture";

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase() === 'vs' && i > 0 && i + 1 < lines.length) {
          teamA = lines[i - 1];
          teamB = lines[i + 1];
          matchTitle = `${teamA} vs ${teamB}`;
          break;
        } else if (lines[i].includes(' vs ')) {
          const parts = lines[i].split(' vs ');
          teamA = parts[0].trim();
          teamB = parts[1].trim();
          matchTitle = `${teamA} vs ${teamB}`;
          break;
        }
      }

      const topPickLine = lines.find(l => l.includes('Top Pick:')) || 'Top Pick: High-Confidence AI Selection';
      const cleanTopPick = topPickLine.replace('★', '').trim();
      const confLine = lines.find(l => /^\d{2}\.\d%$/.test(l)) || '85.0%';

      return { teamA, teamB, matchTitle, cleanTopPick, confLine };
    });

    // Wait 1.5s for the expanded 8-market grid to finish rendering
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log(`6. Taking screenshot for ${scrapedInfo.matchTitle}...`);
    await page.screenshot({ path: 'betboy-slip.png' });
    await browser.close();

    const cleanTagA = '#' + scrapedInfo.teamA.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTagB = '#' + scrapedInfo.teamB.replace(/[^a-zA-Z0-9]/g, '');
    const hashtags = `${cleanTagA} ${cleanTagB} #BetBoyAI #FootballTips #AIPredictor`;

    const dynamicCaptions = [
      `🚨 GREEN PICK LOCKED: ${scrapedInfo.matchTitle} (${scrapedInfo.confLine} AI Confidence)!\n\n⭐ ${scrapedInfo.cleanTopPick}\n\nHigh-probability markets like Over 1.5 Goals and 1st Half Over 0.5 are primed to CASH. The AI is reading this game perfectly! ✅\n\nFree trial link in bio 👇\n\n${hashtags}`,
      
      `💥 BOOM! The AI has crunched the xG & tactical data for ${scrapedInfo.matchTitle}!\n\n⭐ ${scrapedInfo.cleanTopPick}\n\nWith an overall ${scrapedInfo.confLine} confidence rating, the numbers are heavily backing all 8 ranked markets today. ✅\n\nFree trial link in bio 👇\n\n${hashtags}`,
      
      `⚔️ ${scrapedInfo.matchTitle} — Full 8-Market AI Breakdown is LIVE!\n\n⭐ ${scrapedInfo.cleanTopPick}\n\nOur model has isolated a ${scrapedInfo.confLine} edge on this fixture. Check the ranked percentages below before kick-off! ✅\n\nFree trial link in bio 👇\n\n${hashtags}`
    ];

    const finalTweet = dynamicCaptions[Math.floor(Math.random() * dynamicCaptions.length)];

    console.log('7. Uploading image and posting to X...');
    const mediaId = await client.v1.uploadMedia('./betboy-slip.png');
    await client.v2.tweet({
      text: finalTweet,
      media: { media_ids: [mediaId] }
    });

    console.log('8. Automated tweet posted successfully!');
  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runAutomation();
