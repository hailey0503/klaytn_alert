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
  klaytnAlert() 
  wemixAlert()
  //mbxAlert()
}

async function klaytnAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.warn(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_KLAY;
  winston.warn('39',threshold);
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
        //winston.warn('57',whaleThreshold);
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
          const price = await getPrice("KLAY"); //current price!! 
          const klay_amount = Number(ethers.utils.formatEther(value))
          console.log('70',klay_amount)
          winston.warn('74',price);
          winston.warn('75',klay_amount);
          const d_value_bigN = ethers.BigNumber.from(value).mul(price * 10 ** 10).div(10 ** 10)
          const d_value = Number(ethers.utils.formatEther(d_value_bigN))
          console.log('78',d_value)
          winston.warn('79',d_value);
          const message = `🐋 ${klay_amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} #Klay (${d_value.toLocaleString("en-US", { maximumFractionDigits: 0})} USD) is transfered to ${walletToName} from ${walletFromName} ${link}`; //kimchi.io/tx/txHash
          const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
          console.log("gasPrice", gasPrice);
          console.log("price", price)
          console.log("klay_amount", klay_amount)
          console.log("message", message)
          winston.warn('86',message);
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
            link: `https://scope.klaytn.com/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "transactions"); 
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

async function wemixAlert() {
  const wsUrl = process.env.wsUrl_wemix;
  winston.warn(wsUrl);
  const networkId = 1111;
  const threshold = process.env.Threshold_WEMIX;
  const provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
  const coinName = "WeMix"
  const network_id_pair = { networkId: coinName };
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
        //console.log("wemix thisTx",thisTx)
        if (value.gte(whaleThreshold)) {
          winston.debug('35 in')
          const receipt = await thisTx.wait();
          // console.log("gas??",receipt)
          const fromAddress = thisTx["from"];
          const toAddress = thisTx["to"];
          winston.debug(fromAddress);
          winston.debug(toAddress);

          const sender = fromAddress.slice(0, 7) + "..." + fromAddress.slice(37, 42);
          const receiver = toAddress.slice(0, 7) + "..." + toAddress.slice(37, 42);
         
          //const walletFromName = await fetchWalletInfo(fromAddress);
          //winston.debug("41", walletFromName);
          //const walletToName = await fetchWalletInfo(toAddress);
          //winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice(coinName.toUpperCase()); //current price!! 

          const transfer_amount = Number(ethers.utils.formatEther(value))
          console.log('159',transfer_amount)
          const d_value_bigN = ethers.BigNumber.from(value).mul(price* 10 ** 10).div(10 ** 10)
          console.log('161',d_value_bigN)
          const d_value = Number(ethers.utils.formatEther(d_value_bigN))
          console.log('163',d_value)
          const message = `🐋 ${transfer_amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} #Wemix (${d_value.toLocaleString("en-US", { maximumFractionDigits: 0})} USD) is transfered to ${sender} from ${receiver} ${link}`; //kimchi.io/tx/txHash
          const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
          console.log("gasPrice", gasPrice);
          console.log("price", price)
          console.log("wemix transfer_amount", transfer_amount)
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
            sender: sender,
            sender_full: fromAddress,
            receiver: receiver,
            receiver_full: toAddress,
            amount:  ethers.utils.formatEther(value),
            fee: gasFeeToString,
            link: `https://explorer.wemix.com/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "wemix"); //why {}??
          console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      }
    } catch (e) {
      winston.error("201 winston error", e);
    }
  });
}


async function mbxAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.warn(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_KLAY;
  const provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
  const network_id_pair = { networkId: "MBX" };
  //winston.warn('14')
  // subscribe new block

  const contractAddress = "0xd068c52d81f4409b9502da926ace3301cc41f623"
  const contractAbi = ["event Transfer(address indexed from, address indexed to, uint amount)"]
  
  const contract = new ethers.Contract(contractAddress, contractAbi, provider);
  contract.on("Transfer", async (from, to, amount, event) => {
    try {
        console.log("event", event)
        const value = amount;
        const txHash = thisTx["hash"]; //in event
        const whaleThreshold = ethers.utils.parseEther(threshold);
        //winston.debug('33',whaleThreshold);
        if (value.gte(whaleThreshold)) {
          //winston.debug('35 in')
          const receipt = await thisTx.wait(); //??
          // console.log("gas??",receipt)
          const fromAddress = from;
          const toAddress = to;
          winston.debug(fromAddress);
          winston.debug(toAddress);
          const walletFromName = await fetchWalletInfo(fromAddress);
          winston.debug("41", walletFromName);
          const walletToName = await fetchWalletInfo(toAddress);
          winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("MBX"); //current price!! 
          const klay_amount = Number(ethers.utils.formatEther(value))
          console.log('70',klay_amount)
          const d_value_bigN = ethers.BigNumber.from(value).mul(price * 10 ** 10).div(10 ** 10)
          const d_value = Number(ethers.utils.formatEther(d_value_bigN))
          console.log('73',d_value)
          const message = `🐋 ${klay_amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} #MBX (${d_value.toLocaleString("en-US", { maximumFractionDigits: 0})} USD) is transfered to ${walletToName} from ${walletFromName} ${link}`; //kimchi.io/tx/txHash
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
            link: `https://scope.klaytn.com/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "transactions"); 
          console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      
    } catch (e) {
      winston.error("bmx winston error", e);
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

async function insertBlockchainData(data, symbol) {
  const db = client.db("kimchi"); // Replace with your database name
  const collection = db.collection(symbol); // Replace with your collection name
  try {
    const result = await collection.insertOne(data);
    console.log("db_result_id(119)", result);
    return result;
  } catch (error) {
    console.error("Error inserting blockchain data:", error);
  }
}

async function getPrice(coinName) {
  const coinmarketcap = "https://kimchi-web.vercel.app/api/coinmarketcap";
  try {
    const response = await fetch(coinmarketcap);
    
    if (response.ok) {
      const data = await response.json();
      console.log("230 data", data);
      if (data && Object.keys(data).length > 1) {
        // Log all keys in the data object to verify the content
        console.log("All keys in data:", Object.keys(data));
      } else {
        throw new Error("Empty or invalid data received from the API.");
      }
      // Check if the coinName exists in the data object
      if (data.hasOwnProperty(coinName)) {
        return data[coinName].currentPriceUSD.toFixed(10);
      } else {
        throw new Error(`Coin data for '${coinName}' not found.`);
      }
    } else {
      throw new Error("Failed to fetch data from the API.");
    }
  } catch (error) {
    console.error("Error:", error.message);
    return null; // Return null or handle the error as required
  }
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
  console.log("163 telegram in")
  try {
    await sendMessage(arg);
    console.log("telegram sent")
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
