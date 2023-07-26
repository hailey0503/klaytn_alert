require("dotenv").config();
const ethers = require("ethers");
const winston = require("../winston.js");
const { userClient } = require("../twitterClient.js");
const { sendMessage } = require("../telegram.js")


async function main() {
  const wsUrl = process.env.wsUrl;
  // winston.warn(wsUrl);
  const networkId = 8217;

  const provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);

  // subscribe new block
  provider.on("block", async (block) => {
    try {
      const result = await provider.getBlockWithTransactions(block);
      const transactions = result.transactions;

      var len = transactions.length;

      winston.debug(len);

      for (let i = 0; i < len; i++) {
        const thisTx = transactions[i]; //provider.getTransaction

        const value = thisTx["value"];
        const txHash = thisTx["hash"];
        const whaleThreshold = ethers.utils.parseEther("100000");

        if (value.gte(whaleThreshold)) {
          const fromAddress = thisTx["from"];
          const toAddress = thisTx["to"];
          const walletFromName = await fetchWalletInfo(fromAddress);
          const walletToName = await fetchWalletInfo(toAddress);
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
          await Promise.all([tweetPromise, telegramPromise]) 
        }
      }
    } catch (e) {
      winston.error(e);
    }
  });
}

async function fetchWalletInfo(address) {
  const klaytnScope = "https://api-cypress-v3.scope.klaytn.com/v2/accounts/";
  const res = await fetch(klaytnScope + address);
  const resJson = await res.json();
  const walletInfo = resJson.result;
  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  const walletName = walletInfo.addressName || addressShort;
  winston.debug("from_wallet_name: " + walletName);
  return walletName;
}

async function tweet(arg) {
  try {
    await userClient.v2.tweet(arg);
  } catch (e) {
    console.error(e);
  }
}
async function telegram(arg) {
  try {
    await sendMessage(arg) 
  } catch (e) {
    console.error(e)
  }
}
main()
  .then(/*() => process.exit(0)*/)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
