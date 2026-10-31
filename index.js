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
    
    // Increased timeout to 60s and relaxed networkidle
    await page.goto('https://www.betboyai.co.uk', { waitUntil: 'networkidle2', timeout: 60000 });
    
    const scrapedTeams = await page.evaluate(() => {
      const slip = document.getElementById('topAccaSlipBox');
      if (slip) slip.classList.remove('hidden');
      
      const teamNodes = document.querySelectorAll('#topAccaSlipList b.text-white');
      return Array.from(teamNodes)
        .map(node => node.innerText.replace(/[^a-zA-Z0-9]/g, ''))
        .slice(0, 4);
    });
    
    const matchBox = await page.waitForSelector('#topAccaSlipBox'); 
    await matchBox.screenshot({ path: 'betboy-slip.png' });
    await browser.close();

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
