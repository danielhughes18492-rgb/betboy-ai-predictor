const puppeteer = require('puppeteer');
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const captions = [
  "Boom! The algorithm has finalized today's Banker Slip! 🚨\n\nIf you love hitting 1st Half Over 0.5 or Match Winner markets, the AI has done the heavy lifting for you. Let's land these picks today! ✅\n\nFree trial link in bio 👇\n\n",
  
  "⚔️ The AI is locking in on today's fixtures!\n\nThat means high-probability markets like Over 1.5 Goals and BTTS are primed to CASH. The model is reading these match-ups perfectly. ✅\n\nFree trial link in bio 👇\n\n",
  
  "🚨 Data crunched. Value found!\n\nThe AI has isolated the absolute safest markets for today's games. From Over 1.5 Goals to Draw No Bet, the math is backing these selections heavily. ✅\n\nFree trial link in bio 👇\n\n"
];

async function runAutomation() {
  try {
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });

    // Handle browser prompt if the password uses a popup dialog
    page.on('dialog', async dialog => {
      await dialog.accept('12341867');
    });
    
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Automatically find the password input, enter 12341867, and submit
    const passwordInput = await page.$('input[type="password"], input[id*="pass" i], input[placeholder*="pass" i], input[placeholder*="code" i], input');
    if (passwordInput) {
      await passwordInput.click();
      await passwordInput.type('12341867', { delay: 50 });
      await page.keyboard.press('Enter');

      // Also click the login/enter button on the lock screen if Enter doesn't submit it
      await page.evaluate(() => {
        const inputEl = document.querySelector('input[type="password"], input[id*="pass" i], input');
        if (inputEl) {
          const container = inputEl.closest('form, div') || document.body;
          const btn = container.querySelector('button, input[type="submit"], a.btn');
          if (btn) btn.click();
        }
      });
      console.log('Password submitted successfully.');
    }

    // 2. Wait 10 seconds for the site to unlock and load today's fixtures
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 3. Unhide the Acca slip and scrape team names for hashtags
    const scrapedTeams = await page.evaluate(() => {
      const slip = document.getElementById('topAccaSlipBox');
      if (slip) {
        let el = slip;
        while (el && el !== document.body) {
          el.classList.remove('hidden');
          if (window.getComputedStyle(el).display === 'none') {
            el.style.setProperty('display', 'block', 'important');
          }
          if (window.getComputedStyle(el).visibility === 'hidden') {
            el.style.setProperty('visibility', 'visible', 'important');
          }
          el = el.parentElement;
        }
        slip.scrollIntoView();
      }
      
      const teamNodes = document.querySelectorAll('#topAccaSlipList b.text-white');
      return Array.from(teamNodes)
        .map(node => node.innerText.replace(/[^a-zA-Z0-9]/g, ''))
        .slice(0, 4);
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Capture the slip screenshot
    const matchBox = await page.$('#topAccaSlipBox');
    const boxSize = matchBox ? await matchBox.boundingBox() : null;
    
    if (boxSize && boxSize.width > 0 && boxSize.height > 0) {
      await matchBox.screenshot({ path: 'betboy-slip.png' });
    } else {
      console.log('Capturing visible screen fallback.');
      await page.screenshot({ path: 'betboy-slip.png' });
    }
    
    await browser.close();

    // 5. Build 5 hashtags and post to X
    const fillerTags = ['#EFL', '#FootballTips', '#BetBoyAI', '#ValueBets', '#AIPredictor'];
    let hashtagsArray = scrapedTeams.map(team => '#' + team);
    
    while (hashtagsArray.length < 5) {
      hashtagsArray.push(fillerTags[hashtagsArray.length]);
    }
    const finalHashtags = hashtagsArray.slice(0, 5).join(' ');

    const mediaId = await client.v1.uploadMedia('./betboy-slip.png');
    const randomCaption = captions[Math.floor(Math.random() * captions.length)];

    await client.v2.tweet({
      text: randomCaption + finalHashtags,
      media: { media_ids: [mediaId] }
    });
    console.log('Automated tweet posted successfully.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1); 
  }
}
runAutomation();
