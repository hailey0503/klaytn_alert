require("dotenv").config();
const ethers = require("ethers");
const winston = require("./winston.js");
const { userClient } = require("./twitterClient.js");
const { sendMessage } = require("./telegram.js");
const { discordClient, sendDiscordMessage } = require("./discord.js");
const { MongoClient } = require("mongodb");


const uri = process.env.DB_URL; // Replace with your MongoDB URI
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}


async function main() {
  connectToMongoDB();
  // Initial fetch when the server starts
  const wsUrl = process.env.wsUrl;
  winston.warn(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold;
  const provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
  const network_id_pair = { networkId: "Klaytn" };
  //winston.warn('14')
  // subscribe new block
  provider.on("block", async (block) => {
    try {
      const result = await provider.getBlockWithTransactions(block);
      const transactions = result.transactions;

      var len = transactions.length;

      for (let i = 0; i < len; i++) {
        const thisTx = transactions[i]; //provider.getTransaction
        const value = thisTx["value"];
        const txHash = thisTx["hash"];
        const whaleThreshold = ethers.utils.parseEther(threshold);
        //winston.debug('33',whaleThreshold);
        if (value.gte(whaleThreshold)) {
          //winston.debug('35 in')
          const receipt = await thisTx.wait();
          // console.log("gas??",receipt)
          const fromAddress = thisTx["from"];
          const toAddress = thisTx["to"];
          winston.debug(fromAddress);
          winston.debug(toAddress);
          const walletFromName = await fetchWalletInfo(fromAddress);
          winston.debug("41", walletFromName);
          const walletToName = await fetchWalletInfo(toAddress);
          winston.debug("43", walletToName);
          const link = "https://kimchi-web.vercel.app/tx/" + txHash;
          const price = await getPrice(); //current price!! 
          const klay_amount = Number(ethers.utils.formatEther(
            value
          ))
          const d_value = price * klay_amount
          const message = `🐋 ${klay_amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} #Klay (${d_value.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD) is transfered to ${walletToName} from ${walletFromName} ${link}`; //kimchi.io/tx/txHash
          const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
          console.log("gasPrice", gasPrice);
          console.log("price", price)
          console.log("klay_amount", klay_amount)
          console.log("message", message)
          const gasUsed = ethers.utils.formatEther(receipt.gasUsed._hex);
          console.log("USED", gasUsed);
          const gasFee = gasUsed * gasPrice * 10 ** 18; ////how to make gasFee * 10^18?? in better way??
          console.log("gasFee", gasFee);
          console.log("Value", value, typeof(value));
          console.log("gasFeeString", gasFee.toString());
          const gasFeeToString = gasFee.toString();
          const blockchainData = {
            blockchainName: network_id_pair.networkId,
            timestamp: new Date(),
            txHash: txHash,
            sender: walletFromName,
            sender_full: fromAddress,
            receiver: walletToName,
            receiver_full: toAddress,
            amount:  ethers.utils.formatEther(value),
            fee: gasFeeToString,
            link: "https://scope.klaytn.com/tx/",
          };

          const db_result = insertBlockchainData(blockchainData); //why {}??
          console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      }
    } catch (e) {
      winston.error("109 winston error", e);
    }
  });
}

async function fetchWalletInfo(address) {
  winston.debug("69 fetch in");
  const klaytnScope = "https://api-cypress.klaytnscope.com/v2/accounts/";
  const res = await fetch(klaytnScope + address);
  const resJson = await res.json();
  const walletInfo = resJson.result;
  console.log("107", walletInfo);
  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  const walletName = walletInfo.addressName || addressShort;
  winston.debug("from_wallet_name: " + walletName);
  return walletName;
}

async function insertBlockchainData(data) {
  const db = client.db("kimchi"); // Replace with your database name
  const collection = db.collection("transactions"); // Replace with your collection name
  try {
    const result = await collection.insertOne(data);
    //resultID = result.insertedId
    console.log("db_result_id(119)", result);
    return result;
  } catch (error) {
    console.error("Error inserting blockchain data:", error);
  }
}

async function getPrice() {
  const coinmarketcap = "https://kimchi-web.vercel.app/api/coinmarketcap";
  let priceData = 0
  await fetch(coinmarketcap).then(function(response) {
    // The response is a Response instance.
    // You parse the data into a useable format using `.json()`
    return response.json();
  }).then(function(data) {
    // `data` is the parsed version of the JSON returned from the above endpoint.
    console.log(data);  // { "userId": 1, "id": 1, "title": "...", "body": "..." }
    priceData = data
    
  });
  console.log('151',priceData)
  return priceData.currentPriceUSD
 
}

async function tweet(arg) {
  winston.debug("74 tweet in");
  try {
    await userClient.v2.tweet(arg);
  } catch (e) {
    console.error(e);
  }
}
async function telegram(arg) {
  winston.debug("82 telegram in");
  try {
    await sendMessage(arg);
  } catch (e) {
    console.error(e);
  }
}
async function discord(arg) {
  winston.debug("discord in");
  try {
    await sendDiscordMessage(arg);
  } catch (e) {
    winston.debug("discord e");
    console.error(e);
  }
}
main()
  .then(/*() => process.exit(0)*/)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
