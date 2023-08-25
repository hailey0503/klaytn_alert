require("dotenv").config();
const ethers = require("ethers");
const winston = require("./winston.js");
const { userClient } = require("./twitterClient.js");
const { sendMessage } = require("./telegram.js")
const { discordClient, sendDiscordMessage } = require("./discord.js");


async function main() {
  const wsUrl = process.env.wsUrl;
  winston.warn(wsUrl);
  const networkId = 8217;

  const provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
  //winston.warn('14')
  // subscribe new block
  provider.on("block", async (block) => {
    try {
      const result = await provider.getBlockWithTransactions(block);
      const transactions = result.transactions;

      var len = transactions.length;

      winston.debug('24',len);

      for (let i = 0; i < len; i++) {
        //winston.debug('27',i);
        const thisTx = transactions[i]; //provider.getTransaction
        //winston.debug('29',thisTx);
        const value = thisTx["value"];
        const txHash = thisTx["hash"];
        const whaleThreshold = ethers.utils.parseEther("10");
        //winston.debug('33',whaleThreshold);
        if (value.gte(whaleThreshold)) {
          //winston.debug('35 in')
          const fromAddress = thisTx["from"];
          const toAddress = thisTx["to"];
          winston.debug(fromAddress)
          winston.debug(toAddress)
          const walletFromName = await fetchWalletInfo(fromAddress);
          winston.debug('41', walletFromName)
          const walletToName = await fetchWalletInfo(toAddress);
          winston.debug('43', walletToName)
          const link = "https://scope.klaytn.com/tx/" + txHash;
          const message = `${ethers.utils.formatEther(
            value
          )} #Klay is transfered to ${walletToName} from ${walletFromName} ${link}`
          
          const tweetPromise = tweet(
            message
          );
          const telegramPromise = telegram(
            message
          )
          const discordPromise = discord(
            message
          )
          await Promise.all([tweetPromise, telegramPromise, discordPromise]) 
        }
      }
    } catch (e) {
      winston.error('57',e);
    }
  });
}


async function fetchWalletInfo(address) {
  winston.debug('69 fetch in')
  const klaytnScope = "https://api-cypress.klaytnscope.com/v2/accounts/";
  const res = await fetch(klaytnScope + address);
  console.log('72',res)
  const resJson = await res.json();
  console.log('74',resJson)
  const walletInfo = resJson.result;
  console.log('76',walletInfo)
  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  const walletName = walletInfo.addressName || addressShort;
  winston.debug("from_wallet_name: " + walletName);
  return walletName;
}

async function tweet(arg) {
  winston.debug('74 tweet in');
  try {
    await userClient.v2.tweet(arg);
  } catch (e) {
    console.error(e);
  }
}
async function telegram(arg) {
  winston.debug('82 telegram in');
  try {
    await sendMessage(arg) 
  } catch (e) {
    console.error(e)
  }
}
async function discord(arg) { //need to update
  winston.debug("discord in")
  try {
    await sendDiscordMessage(arg);
  } catch (e) {
    winston.debug("discord e")
    console.error(e);
  }
}
main()
  .then(/*() => process.exit(0)*/)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
