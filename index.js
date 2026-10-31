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
        '--disable-software-rasterizer'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.emulateTimezone('Europe/London');

    // Block PayPal SDK and trackers from freezing the lock screen
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url().toLowerCase();
      if (url.includes('paypal.com') || url.includes('google-analytics') || url.includes('googletagmanager')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    page.on('dialog', async dialog => {
      console.log('Auto-accepting dialog:', dialog.message());
      await dialog.accept('12341867');
    });

    // Strip heavy GPU blur effects and cap long fixture lists so the CPU never freezes
    await page.evaluateOnNewDocument(() => {
      window.alert = msg => console.log('Alert:', msg);
      window.confirm = () => true;

      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          animation: none !important;
          transition: none !important;
        }
        div > div:nth-child(n+8) {
          content-visibility: auto;
        }
      `;
      document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(style);
      });
    });

    console.log('2. Loading betboyai.co.uk...');
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('3. Entering password and clicking Unlock Access...');
    const loginResult = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      let filled = 0;
      for (const inp of inputs) {
        const ph = (inp.placeholder || '').toLowerCase();
        if (!ph.includes('search')) {
          inp.focus();
          inp.value = '12341867';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          filled++;
        }
      }

      const elements = Array.from(document.querySelectorAll('button, a, div, span'));
      const unlockBtn = elements.reverse().find(
        el => el.textContent && el.textContent.trim() === 'Unlock Access'
      );
      if (unlockBtn) unlockBtn.click();

      return { filledInputs: filled, clickedUnlock: !!unlockBtn };
    });
    console.log('Login step:', JSON.stringify(loginResult));

    console.log('4. Waiting for Green Picks to load...');
    let foundFixtures = false;
    for (let attempt = 1; attempt <= 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      const status = await page.evaluate(() => {
        const bodyText = document.body ? document.body.innerText : '';
        const hasMarkets = bodyText.toUpperCase().includes('TAP FOR 8 RANKED MARKETS');
        const stillLocked = bodyText.includes('Unlock Access');

        // If still on lock screen after 3 checks, also try clicking Teaser/Preview or Enter
        if (stillLocked && !hasMarkets) {
          const els = Array.from(document.querySelectorAll('button, a, div'));
          const previewBtn = els.reverse().find(
            e => e.textContent && e.textContent.includes('Try Free Preview')
          );
          if (previewBtn && window._triedPreview) previewBtn.click();
          window._triedPreview = true;
        }

        return {
          hasMarkets,
          stillLocked,
          snippet: bodyText.replace(/\s+/g, ' ').slice(0, 120)
        };
      });

      console.log(`Check ${attempt}: markets=${status.hasMarkets}, locked=${status.stillLocked} | "${status.snippet}"`);
      if (status.hasMarkets) {
        foundFixtures = true;
        break;
      }
    }

    console.log('5. Expanding a top Green Pick card and reading stats...');
    const scrapedInfo = await page.evaluate(() => {
      // Remove excess fixture cards further down the page to keep rendering instant
      const allCards = Array.from(document.querySelectorAll('div')).filter(
        el => el.textContent && el.textContent.includes('TAP FOR 8 RANKED MARKETS') && el.clientHeight > 80 && el.clientHeight < 350
      );
      if (allCards.length > 5) {
        allCards.slice(5).forEach(c => c.remove());
      }

      const nodes = Array.from(document.querySelectorAll('div, span, button, p'));
      const toggles = nodes.filter(el => {
        const txt = el.textContent ? el.textContent.trim().toUpperCase() : '';
        return txt.includes('TAP FOR 8 RANKED MARKETS') && el.children.length <= 1;
      });

      let card = null;
      if (toggles.length > 0) {
        const pickIndex = Math.floor(Math.random() * Math.min(3, toggles.length));
        const chosenToggle = toggles[pickIndex];
        chosenToggle.click();

        let el = chosenToggle.parentElement;
        for (let i = 0; i < 6 && el && el !== document.body; i++) {
          if (el.textContent && el.textContent.includes(' vs ')) {
            card = el;
            if (el.clientHeight > 200) break;
          }
          el = el.parentElement;
        }
      }

      if (card) {
        card.scrollIntoView({ behavior: 'instant', block: 'center' });
      }

      const rawText = card ? card.innerText : (document.body ? document.body.innerText : '');
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
