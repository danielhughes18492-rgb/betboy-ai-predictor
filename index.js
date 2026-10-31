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
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

    console.log('2. Loading betboyai.co.uk...');
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('3. Entering password and clicking Unlock Access...');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passInput = inputs.find(i => i.offsetParent !== null) || inputs[0];
      if (passInput) {
        passInput.value = '';
        passInput.focus();
      }
    });

    await page.keyboard.type('12341867', { delay: 50 });

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div, a, span'));
      const unlockBtn = buttons.find(
        el => el.innerText && el.innerText.trim() === 'Unlock Access'
      );
      if (unlockBtn) unlockBtn.click();
    });

    console.log('4. Waiting for Green Picks to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('5. Expanding a top Green Pick card and reading stats...');
    const matchData = await page.evaluate(() => {
      // Find all "TAP FOR 8 RANKED MARKETS" toggles
      const allElements = Array.from(document.querySelectorAll('*'));
      const marketToggles = allElements.filter(
        el =>
          el.children.length === 0 &&
          el.innerText &&
          el.innerText.toUpperCase().includes('TAP FOR 8 RANKED MARKETS')
      );

      // Pick one of the top 3 fixtures randomly so your 3 daily tweets vary
      let chosenToggle = null;
      if (marketToggles.length > 0) {
        const pickIndex = Math.floor(Math.random() * Math.min(3, marketToggles.length));
        chosenToggle = marketToggles[pickIndex];
        chosenToggle.click();
      }

      return { toggled: !!chosenToggle, count: marketToggles.length };
    });

    console.log(`Found ${matchData.count} fixtures. Waiting for markets to expand...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract the text from the expanded card and scroll it into view
    const scrapedInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('div, section, article'));
      const expandedCard = allElements.find(
        el =>
          el.innerText &&
          el.innerText.includes('8 BETTING MARKETS') &&
          el.innerText.includes('Top Pick:') &&
          el.clientHeight > 250 &&
          el.clientHeight < 800
      );

      if (expandedCard) {
        expandedCard.scrollIntoView({ behavior: 'instant', block: 'center' });
      }

      const text = expandedCard ? expandedCard.innerText : document.body.innerText;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Find teams line (e.g., "Chelsea vs Man Utd")
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

      // Find Top Pick line
      const topPickLine = lines.find(l => l.includes('Top Pick:')) || 'Top Pick: High-Confidence AI Selection';
      const cleanTopPick = topPickLine.replace('★', '').trim();

      // Find overall confidence percentage
      const confLine = lines.find(l => /^\d{2}\.\d%$/.test(l)) || '85.0%';

      return { teamA, teamB, matchTitle, cleanTopPick, confLine };
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('6. Taking screenshot...');
    await page.screenshot({ path: 'betboy-slip.png' });
    await browser.close();

    // Build dynamic hashtags from the two teams in the screenshot
    const cleanTagA = '#' + scrapedInfo.teamA.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTagB = '#' + scrapedInfo.teamB.replace(/[^a-zA-Z0-9]/g, '');
    const hashtags = `${cleanTagA} ${cleanTagB} #BetBoyAI #FootballTips #AIPredictor`;

    // Rotate between 3 high-energy templates using the exact stats from the screenshot
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
