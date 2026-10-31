const puppeteer = require('puppeteer');
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function runAutomation() {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'networkidle0' });
    
    await page.evaluate(() => {
      const slip = document.getElementById('topAccaSlipBox');
      if (slip) slip.classList.remove('hidden');
    });
    
    const matchBox = await page.waitForSelector('#topAccaSlipBox'); 
    await matchBox.screenshot({ path: 'betboy-slip.png' });
    await browser.close();

    const mediaId = await client.v1.uploadMedia('./betboy-slip.png');
    await client.v2.tweet({
      text: "🚨 AI Daily Banker Slip Updated!\n\nTop high-confidence picks locked in for tonight's fixtures. 📊\n\nRun the numbers for free: www.betboyai.co.uk\n\n#BetBoyAI #FootballTips",
      media: { media_ids: [mediaId] }
    });
    console.log('Automated tweet posted successfully.');
  } catch (error) {
    console.error('Error:', error);
  }
}
runAutomation();
