const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function runAutomation() {
  try {
    console.log('1. Preparing Green Pick update...');
    
    const tweetText = `🚨 GREEN PICK LOCKED: Chelsea vs Man Utd (82.9% AI Confidence)!\n\n⭐ Top Pick: Chelsea/Draw (1X) (93.5%)\n\nOver 1.5 Goals (90.6%) & 1st Half Over 0.5 (80.1%) are primed to cash. The AI is reading this perfectly! ✅\n\nFree trial link in bio 👇\n\n#Chelsea #ManUtd #BetBoyAI #FootballTips #AIPredictor`;

    console.log('2. Posting directly to X...');
    await client.v2.tweet({
      text: tweetText
    });

    console.log('Tweet posted successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runAutomation();
