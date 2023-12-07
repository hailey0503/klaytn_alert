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
  klaytnAlert();
  wemixAlert();
  mbxAlert();
  boraAlert();
  setInterval(() => console.log("keepalive"), 60 * 5 * 1000);
}

async function klaytnAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.debug(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_KLAY;
  winston.debug("37", threshold);

  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  let provider;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);

    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the klay connection is alive, sending a ping"
        );

        provider._websocket.ping();

        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      // TODO: handle contract listeners setup + indexing
    });
    const network_id_pair = { networkId: "Klaytn" };
    // subscribe new block
    provider.on("block", async (block) => {
      try {
        if (block % 300 === 0) {
          winston.debug("blockNum klay", block);
        }
        const result = await provider.getBlockWithTransactions(block);
        const transactions = result.transactions;

        var len = transactions.length;

        for (let i = 0; i < len; i++) {
          const thisTx = transactions[i]; //provider.getTransaction
          const value = thisTx["value"];
          const txHash = thisTx["hash"];
          const whaleThreshold = ethers.utils.parseEther(threshold);
          //winston.debug('54',value);
          //winston.warn('57',whaleThreshold);
          if (value.gte(whaleThreshold)) {
            winston.debug("klaytn in", value);
            //winston.debug('58',whaleThreshold);
            const receipt = await thisTx.wait();
            // console.log("gas??",receipt)
            const fromAddress = thisTx["from"];
            const toAddress = thisTx["to"];
            //winston.debug(fromAddress);
            //winston.debug(toAddress);
            const walletFromName = await fetchWalletInfo(fromAddress);
            //winston.debug("41", walletFromName);
            const walletToName = await fetchWalletInfo(toAddress);
            //winston.debug("43", walletToName);
            const link = "https://kimchiwhale.io/tx/" + txHash;
            const price = await getPrice("KLAY"); //current price!!
            const klay_amount = Number(ethers.utils.formatEther(value));
            console.log("117 currnet krw price returned", price);
            console.log("118 value (bignumber)", value);
            console.log("119 value to number", klay_amount);

            const d_value_bigN = ethers.BigNumber.from(value)
              .mul(price * 10 ** 10)
              .div(10 ** 10);
            const d_value = Number(ethers.utils.formatEther(d_value_bigN));
            const message = `🐋 ${walletFromName} 에서 ${walletToName} 로 ${klay_amount.toLocaleString(
              "en-US",
              {
                maximumFractionDigits: 0,
              }
            )} #Klay (${d_value.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}원) 전송 ${link}`; //kimchi.io/tx/txHash
            const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
            //console.log("gasPrice", gasPrice);
            //console.log("price", price);
            //console.log("klay_amount", klay_amount);
            console.log("message", message);
            //winston.debug("86", message);
            const gasUsed = ethers.utils.formatEther(receipt.gasUsed._hex);
            //console.log("USED", gasUsed);
            const gasFee = gasUsed * gasPrice * 10 ** 18; ////how to make gasFee * 10^18?? in better way??
            //console.log("gasFee", gasFee);
            //console.log("Value", value, typeof value);
            //console.log("gasFeeString", gasFee.toString());
            const gasFeeToString = gasFee.toString();
            const blockchainData = {
              blockchainName: network_id_pair.networkId,
              timestamp: new Date(),
              txHash: txHash,
              sender: walletFromName,
              sender_full: fromAddress,
              receiver: walletToName,
              receiver_full: toAddress,
              amount: ethers.utils.formatEther(value),
              fee: gasFeeToString,
              link: `https://scope.klaytn.com/tx/`,
            };

            const db_result = insertBlockchainData(
              blockchainData,
              "transactions"
            );
            //console.log("db_result", db_result);

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

    provider._websocket.on("close", () => {
      winston.error("The klay websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so klay connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function wemixAlert() {
  const wsUrl = process.env.wsUrl_wemix;
  winston.debug(wsUrl);
  const networkId = 1111;
  const threshold = process.env.Threshold_WEMIX;
  winston.debug("185", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  let provider;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the wemix connection is alive, sending a ping"
        );

        provider._websocket.ping();

        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      // TODO: handle contract listeners setup + indexing
    });
    const coinName = "WeMix";
    const network_id_pair = { networkId: coinName };
    //winston.warn('14')
    // subscribe new block
    provider.on("block", async (block) => {
      try {
        if (block % 300 === 0) {
          winston.debug("blockNum wemix", block);
        }
        const result = await provider.getBlockWithTransactions(block);
        const transactions = result.transactions;

        var len = transactions.length;

        for (let i = 0; i < len; i++) {
          const thisTx = transactions[i]; //provider.getTransaction
          const value = thisTx["value"];
          const txHash = thisTx["hash"];
          const whaleThreshold = ethers.utils.parseEther(threshold);

          //winston.debug('54',value);
          if (value.gte(whaleThreshold)) {
            winston.debug("wemix in", value);
            const receipt = await thisTx.wait();
            // console.log("gas??",receipt)
            const fromAddress = thisTx["from"];
            const toAddress = thisTx["to"];
            //winston.debug(fromAddress);
            //winston.debug(toAddress);

            const sender =
              fromAddress.slice(0, 7) + "..." + fromAddress.slice(37, 42);
            const receiver =
              toAddress.slice(0, 7) + "..." + toAddress.slice(37, 42);

            //const walletFromName = await fetchWalletInfo(fromAddress);
            //winston.debug("41", walletFromName);
            //const walletToName = await fetchWalletInfo(toAddress);
            //winston.debug("43", walletToName);
            const link = "https://kimchiwhale.io/tx/" + txHash;
            const price = await getPrice(coinName.toUpperCase()); //current price!!

            const transfer_amount = Number(ethers.utils.formatEther(value));
            console.log("159", transfer_amount);
            const d_value_bigN = ethers.BigNumber.from(value)
              .mul(price * 10 ** 10)
              .div(10 ** 10);
            //console.log("161", d_value_bigN);
            const d_value = Number(ethers.utils.formatEther(d_value_bigN));
            //console.log("163", d_value);
            const message = `🐋 ${receiver} 에서 ${sender} 로 ${transfer_amount.toLocaleString(
              "en-US",
              {
                maximumFractionDigits: 0,
              }
            )} #Wemix (${d_value.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })} 원) 전송 ${link}`; //kimchi.io/tx/txHash
            const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
            //console.log("gasPrice", gasPrice);
            //console.log("price", price);
            //console.log("wemix transfer_amount", transfer_amount);
            console.log("message", message);
            const gasUsed = ethers.utils.formatEther(receipt.gasUsed._hex);
            //console.log("USED", gasUsed);
            const gasFee = gasUsed * gasPrice * 10 ** 18; ////how to make gasFee * 10^18?? in better way??
            //console.log("gasFee", gasFee);
            //console.log("Value", value, typeof value);
            //console.log("gasFeeString", gasFee.toString());
            const gasFeeToString = gasFee.toString();
            const blockchainData = {
              blockchainName: network_id_pair.networkId,
              timestamp: new Date(),
              txHash: txHash,
              sender: sender,
              sender_full: fromAddress,
              receiver: receiver,
              receiver_full: toAddress,
              amount: ethers.utils.formatEther(value),
              fee: gasFeeToString,
              link: `https://explorer.wemix.com/tx/`,
            };

            const db_result = insertBlockchainData(blockchainData, "wemix"); //why {}??
            // console.log("db_result", db_result);

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

    provider._websocket.on("close", () => {
      winston.error("The wemix websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so wemix connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function mbxAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.debug(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_MBX;
  winston.debug("332", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "MBX" };
  let provider;
  let contract;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the mbx connection is alive, sending a ping"
        );

        provider._websocket.ping();

        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      // TODO: handle contract listeners setup + indexing
    });

    const contractAddress = "0xd068c52d81f4409b9502da926ace3301cc41f623";
    const contractAbi = [
      "event Transfer(address indexed from, address indexed to, uint amount)",
    ];

    contract = new ethers.Contract(contractAddress, contractAbi, provider);
    contract.on("Transfer", async (from, to, amount, event) => {
      try {
        //console.log("event", event)
        const value = amount;
        const txHash = event["transactionHash"]; //in event
        const whaleThreshold = ethers.utils.parseEther(threshold);

        if (value.gte(whaleThreshold)) {
          winston.debug("mbx in", value);
          const thisTx = await provider.getTransaction(txHash);
          //console.log("gettx", thisTx);
          const receipt = await thisTx.wait();
          const fromAddress = from;
          const toAddress = to;
          //winston.debug(fromAddress);
          // winston.debug(toAddress);
          const walletFromName = await fetchWalletInfo(fromAddress);
          // winston.debug("41", walletFromName);
          const walletToName = await fetchWalletInfo(toAddress);
          // winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("MBX"); //current price!!
          const mbx_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${mbx_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #MBX (${d_value.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} 원) 전송 ${link}`; //kimchi.io/tx/txHash
          const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
          //console.log("gasPrice", gasPrice);
          //console.log("price", price);
          //console.log("klay_amount", mbx_amount);
          console.log("message", message);
          const gasUsed = ethers.utils.formatEther(receipt.gasUsed._hex);
          //console.log("USED", gasUsed);
          const gasFee = gasUsed * gasPrice * 10 ** 18; ////how to make gasFee * 10^18?? in better way??
          //console.log("gasFee", gasFee);
          //console.log("Value", value, typeof value);
          //console.log("gasFeeString", gasFee.toString());
          const gasFeeToString = gasFee.toString();
          const blockchainData = {
            blockchainName: network_id_pair.networkId,
            timestamp: new Date(),
            txHash: txHash,
            sender: walletFromName,
            sender_full: fromAddress,
            receiver: walletToName,
            receiver_full: toAddress,
            amount: ethers.utils.formatEther(value),
            fee: gasFeeToString,
            link: `https://scope.klaytn.com/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "mbx"); //change it to 'test' when test in local
          //console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("mbx winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The mbx websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so mbx connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function boraAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.debug(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_BORA;
  winston.debug("466", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "BORA" };
  let provider;
  let contract;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the Bora connection is alive, sending a ping"
        );

        provider._websocket.ping();

        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      // TODO: handle contract listeners setup + indexing
    });

    const contractAddress = "0x02cbe46fb8a1f579254a9b485788f2d86cad51aa";
    const contractAbi = [
      "event Transfer(address indexed from, address indexed to, uint amount)",
    ];

    contract = new ethers.Contract(contractAddress, contractAbi, provider);
    contract.on("Transfer", async (from, to, amount, event) => {
      try {
        //console.log("event", event)
        const value = amount;
        const txHash = event["transactionHash"]; //in event
        const whaleThreshold = ethers.utils.parseEther(threshold);

        if (value.gte(whaleThreshold)) {
          winston.debug("bora in", value);
          const thisTx = await provider.getTransaction(txHash);
          //console.log("gettx", thisTx);
          const receipt = await thisTx.wait();
          const fromAddress = from;
          const toAddress = to;
          //winston.debug(fromAddress);
          // winston.debug(toAddress);
          const walletFromName = await fetchWalletInfo(fromAddress);
          // winston.debug("41", walletFromName);
          const walletToName = await fetchWalletInfo(toAddress);
          // winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("BORA"); //current price!!
          const bora_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${bora_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #BORA (${d_value.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} 원) 전송 ${link}`; //kimchi.io/tx/txHash
          const gasPrice = ethers.utils.formatEther(thisTx["gasPrice"]._hex);
    
          console.log("message", message);
          const gasUsed = ethers.utils.formatEther(receipt.gasUsed._hex);
          //console.log("USED", gasUsed);
          const gasFee = gasUsed * gasPrice * 10 ** 18; ////how to make gasFee * 10^18?? in better way??
          //console.log("gasFee", gasFee);
          //console.log("Value", value, typeof value);
          //console.log("gasFeeString", gasFee.toString());
          const gasFeeToString = gasFee.toString();
          const blockchainData = {
            blockchainName: network_id_pair.networkId,
            timestamp: new Date(),
            txHash: txHash,
            sender: walletFromName,
            sender_full: fromAddress,
            receiver: walletToName,
            receiver_full: toAddress,
            amount: ethers.utils.formatEther(value),
            fee: gasFeeToString,
            link: `https://scope.klaytn.com/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "bora"); //change it to 'test' when test in local
          //console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("bora winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The bora websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so bora connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function fetchWalletInfo(address) {
  winston.debug("69 fetch in");
  const klaytnScope = "https://api-cypress.klaytnscope.com/v2/accounts/";
  const res = await fetch(klaytnScope + address);
  const resJson = await res.json();
  const walletInfo = resJson.result;
  //console.log("107", walletInfo);
  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  const walletName = walletInfo.addressName || addressShort;
  winston.debug("from_wallet_name: " + walletName);
  return walletName;
}

async function insertBlockchainData(data, symbol) {
  const db = client.db("kimchi"); // Replace with your database name
  //const collection = db.collection("test"); // Replace with your collection name
  const collection = db.collection(symbol);
  try {
    const result = await collection.insertOne(data);
    //console.log("db_result_id(119)", result);
    return result;
  } catch (error) {
    console.error("Error inserting blockchain data:", error);
  }
}

async function getPrice(symbol) {
  try {
    // Make a request to the CoinMarketCap API for USD

    // Make a request to the CoinMarketCap API for KRW
    const krwResponse = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=KRW`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP,
        },
      }
    );

    // Check if both requests were successful
    if (krwResponse.status === 200) {
      //const usdData = await usdResponse.json();
      const krwData = await krwResponse.json();

      //const usdQuote = usdData.data[symbol].quote.USD;
      const krwQuote = krwData.data[symbol].quote.KRW;

      // Extract relevant data
      //const currentPriceUSD = usdQuote.price;
      const currentPriceKRW = krwQuote.price;
      //const priceChange24h = usdQuote.percent_change_24h;
      return currentPriceKRW.toFixed(10);
    } else {
      throw "Failed to fetch cryptocurrency data";
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
  console.log("163 telegram in");
  try {
    await sendMessage(arg);
    console.log("telegram sent");
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
    winston.error(error);
    process.exit(1);
  });
