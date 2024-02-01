require("dotenv").config();
const ccxt = require("ccxt");
const ethers = require("ethers");
const winston = require("./winston.js");
const { userClient } = require("./twitterClient.js");
const { sendMessage } = require("./telegram.js");
const { discordClient, sendDiscordMessage } = require("./discord.js");
const { MongoClient } = require("mongodb");
const fs = require("fs");
const { WebsocketClient } = require("@cosmjs/tendermint-rpc");

const result_eth = JSON.parse(fs.readFileSync("./data/accountLabels_eth.json"));
const result_wemix = JSON.parse(
  fs.readFileSync("./data/accountLabels_wemix.json")
);

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
  //Initial fetch when the server starts
  
  klaytnAlert();
  wemixAlert();
  mbxAlert();
  boraAlert();
  //ghubAlert();
  //plaAlert()
  ssxAlert();
  //nptAlert();
  //bfcAlert();
  //ctcAlert();
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
            console.log("message", message);
            //winston.debug("86", message);
            const gasUsed = ethers.utils.formatEther(receipt.gasUsed._hex);
            //console.log("USED", gasUsed);
            const gasFee = gasUsed * gasPrice * 10 ** 18; ////how to make gasFee * 10^18?? in better way??
           
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
            winston.debug("프롬", fromAddress);
            winston.debug("투", toAddress);

            const sender = getWalletInfo_wemix(fromAddress, result_wemix);
            const receiver = getWalletInfo_wemix(toAddress, result_wemix);
            console.log("sender", sender);
            console.log("receiver", receiver);

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
            const message = `🐋 ${sender} 에서 ${receiver} 로 ${transfer_amount.toLocaleString(
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

async function ghubAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.debug(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_GHUB;
  winston.debug("599", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "GHUB" };
  let provider;
  let contract;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the Ghub connection is alive, sending a ping"
        );

        provider._websocket.ping();

        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      // TODO: handle contract listeners setup + indexing
    });

    const contractAddress = "0x4836cc1f355bb2a61c210eaa0cd3f729160cd95e";
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
          winston.debug("ghub in", value);
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
          const price = await getPrice("GHUB"); //current price!!
          const ghub_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${ghub_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #GHUB (${d_value.toLocaleString("en-US", {
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

          const db_result = insertBlockchainData(blockchainData, "ghub"); //change it to 'test' when test in local
          //console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("ghub winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The ghub websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so ghub connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function plaAlert() {
  const wsETHUrl = process.env.WSETHURL;
  winston.debug(wsETHUrl);
  const networkId = 1;
  const threshold = process.env.Threshold_PLA;
  winston.debug("736", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "PLA" };
  let provider;
  let erc20;
  const startConnection = () => {
    console.log("738");
    provider = new ethers.providers.WebSocketProvider(wsETHUrl, networkId); //setting up a WebSocket connection to an Ethereum node.
    let pingTimeout = null;
    let keepAliveInterval = null;
    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the PLA connection is alive, sending a ping"
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
    const abi = [
      // Read-Only Functions
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",

      // Authenticated Functions
      "function transfer(address to, uint amount) returns (bool)",

      // Events
      "event Transfer(address indexed from, address indexed to, uint amount)",
    ];
    const plaAddress = "0x3a4f40631a4f906c2BaD353Ed06De7A5D3fCb430";
    erc20 = new ethers.Contract(plaAddress, abi, provider);
    //sets up an event listener for the "Transfer" event of the ERC-20 token contract.
    erc20.on("Transfer", async (from, to, amount, event) => {
      console.log("758");
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the PLA connection is alive, sending a ping"
        );

        provider._websocket.ping();

        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      try {
        //console.log("event", event)
        const value = amount;
        const txHash = event.transactionHash; //event tx -> console.log
        const whaleThreshold = ethers.utils.parseEther(threshold);

        if (value.gte(whaleThreshold)) {
          winston.debug("pla in", value);
          const thisTx = await provider.getTransaction(txHash);
          //console.log("gettx", thisTx);
          const receipt = await thisTx.wait();
          const fromAddress = from;
          const toAddress = to;
          //winston.debug(fromAddress);
          // winston.debug(toAddress);
          const walletFromName = getWalletInfo_eth(fromAddress);
          // winston.debug("41", walletFromName);
          const walletToName = getWalletInfo_eth(toAddress);
          // winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("pla"); //current price!!
          const pla_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${pla_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #PLA (${d_value.toLocaleString("en-US", {
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
            link: `https://etherscan.io/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "pla"); //change it to 'test' when test in local

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("pla winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The pla websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so pla connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function nptAlert() {
  const wsETHUrl = process.env.WSETHURL;
  winston.debug(wsETHUrl);
  const networkId = 1;
  const threshold = process.env.Threshold_NPT;
  winston.debug("736", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "NPT" };
  let provider;
  let erc20;
  const startConnection = () => {
    console.log("738");
    provider = new ethers.providers.WebSocketProvider(wsETHUrl, networkId); //setting up a WebSocket connection to an Ethereum node.
    let pingTimeout = null;
    let keepAliveInterval = null;
    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the NPT connection is alive, sending a ping"
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
    const abi = [
      // Read-Only Functions
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",

      // Authenticated Functions
      "function transfer(address to, uint amount) returns (bool)",

      // Events
      "event Transfer(address indexed from, address indexed to, uint amount)",
    ];
    const nptAddress = "0x306ee01a6bA3b4a8e993fA2C1ADC7ea24462000c";
    erc20 = new ethers.Contract(nptAddress, abi, provider);
    //sets up an event listener for the "Transfer" event of the ERC-20 token contract.
    erc20.on("Transfer", async (from, to, amount, event) => {
      console.log("758");
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the NPT connection is alive, sending a ping"
        );

        provider._websocket.ping();

        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      try {
        //console.log("event", event)
        const value = amount;
        const txHash = event.transactionHash; //event tx -> console.log
        const whaleThreshold = ethers.utils.parseEther(threshold);

        if (value.gte(whaleThreshold)) {
          winston.debug("npt in", value);
          const thisTx = await provider.getTransaction(txHash);
          //console.log("gettx", thisTx);
          const receipt = await thisTx.wait();
          const fromAddress = from;
          const toAddress = to;
          //winston.debug(fromAddress);
          // winston.debug(toAddress);
          const walletFromName = getWalletInfo_eth(fromAddress);
          // winston.debug("41", walletFromName);
          const walletToName = getWalletInfo_eth(toAddress);
          // winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("npt"); //current price!!
          const npt_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${npt_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #NPT (${d_value.toLocaleString("en-US", {
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
            link: `https://etherscan.io/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "npt"); //change it to 'test' when test in local

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("npt winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The npt websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so npt connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function bfcAlert() {
  const wsETHUrl = process.env.WSETHURL;
  winston.debug(wsETHUrl);
  const networkId = 1;
  const threshold = process.env.Threshold_BFC;
  winston.debug("736", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "BFC" };
  let provider;
  let erc20;
  const startConnection = () => {
    console.log("738");
    provider = new ethers.providers.WebSocketProvider(wsETHUrl, networkId); //setting up a WebSocket connection to an Ethereum node.
    let pingTimeout = null;
    let keepAliveInterval = null;
    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the BFC connection is alive, sending a ping"
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
    const abi = [
      // Read-Only Functions
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",

      // Authenticated Functions
      "function transfer(address to, uint amount) returns (bool)",

      // Events
      "event Transfer(address indexed from, address indexed to, uint amount)",
    ];
    const bfcAddress = "0x0c7D5ae016f806603CB1782bEa29AC69471CAb9c";
    erc20 = new ethers.Contract(bfcAddress, abi, provider);
    //sets up an event listener for the "Transfer" event of the ERC-20 token contract.
    erc20.on("Transfer", async (from, to, amount, event) => {
      console.log("758");
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the BFC connection is alive, sending a ping"
        );

        provider._websocket.ping();

        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      try {
        //console.log("event", event)
        const value = amount;
        const txHash = event.transactionHash; //event tx -> console.log
        const whaleThreshold = ethers.utils.parseEther(threshold);

        if (value.gte(whaleThreshold)) {
          winston.debug("bfc in", value);
          const thisTx = await provider.getTransaction(txHash);
          //console.log("gettx", thisTx);
          const receipt = await thisTx.wait();
          const fromAddress = from;
          const toAddress = to;
          //winston.debug(fromAddress);
          // winston.debug(toAddress);
          const walletFromName = getWalletInfo_eth(fromAddress);
          // winston.debug("41", walletFromName);
          const walletToName = getWalletInfo_eth(toAddress);
          // winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("bfc"); //current price!!
          const bfc_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${bfc_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #BFC (${d_value.toLocaleString("en-US", {
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
            link: `https://etherscan.io/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "bfc"); //change it to 'test' when test in local

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("bfc winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The bfc websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so bfc connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function ctcAlert() {
  const wsETHUrl = process.env.WSETHURL;
  winston.debug(wsETHUrl);
  const networkId = 1;
  const threshold = process.env.Threshold_CTC;
  winston.debug("736", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "CTC" };
  let provider;
  let erc20;
  const startConnection = () => {
    console.log("738");
    provider = new ethers.providers.WebSocketProvider(wsETHUrl, networkId); //setting up a WebSocket connection to an Ethereum node.
    let pingTimeout = null;
    let keepAliveInterval = null;
    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the CTC connection is alive, sending a ping"
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
    const abi = [
      // Read-Only Functions
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",

      // Authenticated Functions
      "function transfer(address to, uint amount) returns (bool)",

      // Events
      "event Transfer(address indexed from, address indexed to, uint amount)",
    ];
    const ctcAddress = "0xa3ee21c306a700e682abcdfe9baa6a08f3820419";
    erc20 = new ethers.Contract(ctcAddress, abi, provider);
    //sets up an event listener for the "Transfer" event of the ERC-20 token contract.
    erc20.on("Transfer", async (from, to, amount, event) => {
      console.log("758");
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the CTC connection is alive, sending a ping"
        );

        provider._websocket.ping();

        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      try {
        //console.log("event", event)
        const value = amount;
        const txHash = event.transactionHash; //event tx -> console.log
        const whaleThreshold = ethers.utils.parseEther(threshold);

        if (value.gte(whaleThreshold)) {
          winston.debug("ctc in", value);
          const thisTx = await provider.getTransaction(txHash);
          //console.log("gettx", thisTx);
          const receipt = await thisTx.wait();
          const fromAddress = from;
          const toAddress = to;
          winston.debug(fromAddress);
          winston.debug(toAddress);
          const walletFromName = getWalletInfo_eth(fromAddress);
           winston.debug("41", walletFromName);
          const walletToName = getWalletInfo_eth(toAddress);
          winston.debug("43", walletToName);
          const link = "https://kimchiwhale.io/tx/" + txHash;
          const price = await getPrice("ctc"); //current price!!
          const ctc_amount = Number(ethers.utils.formatEther(value));
          console.log("70", ctc_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${ctc_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #CTC (${d_value.toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })} 원) 전송 ${link}`; //kimchi.io/tx/txHash
          console.log("msg", message)
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
            link: `https://etherscan.io/tx/`,
          };

          const db_result = insertBlockchainData(blockchainData, "ctc"); //change it to 'test' when test in local

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("ctc winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The ctc websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so ctc connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function klevaAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.debug(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_KLEVA;
  winston.debug("466", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "KLEVA" };
  let provider;
  let contract;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the KLEVA connection is alive, sending a ping"
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

    const contractAddress = "0x5fff3a6c16c2208103f318f4713d4d90601a7313";
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
          winston.debug("KLEVA in", value);
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
          const price = await getPrice("KLEVA"); //current price!!
          const kleva_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${kleva_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #KLEVA (${d_value.toLocaleString("en-US", {
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

          const db_result = insertBlockchainData(blockchainData, "kleva"); //change it to 'test' when test in local
          //console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("kleva winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The kleva websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so kleva connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function ssxAlert() {
  const wsUrl = process.env.wsUrl_klaytn;
  winston.debug(wsUrl);
  const networkId = 8217;
  const threshold = process.env.Threshold_SSX;
  winston.debug("466", threshold);
  const EXPECTED_PONG_BACK = 15000;
  const KEEP_ALIVE_CHECK_INTERVAL = 7500;
  const network_id_pair = { networkId: "SSX" };
  let provider;
  let contract;
  const startConnection = () => {
    provider = new ethers.providers.WebSocketProvider(wsUrl, networkId);
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      keepAliveInterval = setInterval(() => {
        winston.debug(
          "Checking if the SSX connection is alive, sending a ping"
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

    const contractAddress = "0x5fff3a6c16c2208103f318f4713d4d90601a7313";
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
          winston.debug("SSX in", value);
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
          const price = await getPrice("SSX"); //current price!!
          const ssx_amount = Number(ethers.utils.formatEther(value));
          //console.log("70", mbx_amount);
          const d_value_bigN = ethers.BigNumber.from(value)
            .mul(price * 10 ** 10)
            .div(10 ** 10);
          const d_value = Number(ethers.utils.formatEther(d_value_bigN));
          //console.log("73", d_value);
          const message = `🐋 ${walletFromName}에서 ${walletToName}로 ${ssx_amount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          )} #SSX (${d_value.toLocaleString("en-US", {
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

          const db_result = insertBlockchainData(blockchainData, "ssx"); //change it to 'test' when test in local
          //console.log("db_result", db_result);

          const tweetPromise = tweet(message);
          const telegramPromise = telegram(message);
          const discordPromise = discord(message);
          await Promise.all([tweetPromise, telegramPromise, discordPromise]);
        }
      } catch (e) {
        winston.error("ssx winston error", e);
      }
    });

    provider._websocket.on("close", () => {
      winston.error("The ssx websocket connection was closed");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      startConnection();
    });

    provider._websocket.on("pong", () => {
      winston.debug(
        "Received pong, so ssx connection is alive, clearing the timeout"
      );
      clearInterval(pingTimeout);
    });
  };
  startConnection();
}

async function fnsaAlert() {
  console.log("before");
  const startConnection = () => {
    console.log("866");
    const wsEndpoint = process.env.FINSCHIA_RPC;
    const wsClient = new WebsocketClient(wsEndpoint, (err) =>
      console.log("ws client error " + JSON.stringify(err))
    );
    console.log("878");
    let stream = wsClient.listen({
      jsonrpc: "2.0",
      method: "subscribe",
      id: 0,
      params: {
        query: "tm.event='NewBlockHeader'",
      },
    });
    console.log("882", stream);
    stream.addListener({
      complete: () => {
        console.log("complete");
      },
      error: (err) => {
        console.log("error: " + JSON.stringify(err));
      },
      next: (newtx) => {
        try {
          console.log("newTX", newtx);
        } catch (err) {
          console.log(JSON.stringify(err));
        }
      },
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

function getWalletInfo_eth(address) {
  winston.debug("getwallet");
 console.log("1656 address", address)
  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  winston.debug("short", addressShort);
 
  let walletName
  if (result_eth[address]) {
    walletName = result_eth[address].name;
  } else {
    console.log("no known name")
    walletName = addressShort;
  }
  winston.debug("from_wallet_name: " + walletName);
  return walletName;
}

function getWalletInfo_wemix(address, result) {
  winston.debug("getwallet");

  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  winston.debug("short", addressShort);

  winston.debug("result", result[address]);
  const walletName = addressShort;
  if (result_wemix[address]) {
    walletName = result_wemix[address];
  }
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
    // Create an instance of the Upbit exchange
    const exchange = new ccxt.bithumb({ enableRateLimit: true });

    // Fetch ticker data for the specified symbol
    const formattedSymbol = symbol.toUpperCase() + "/KRW"; // Convert to uppercase and add "/KRW"
    const ticker = await exchange.fetchTicker(formattedSymbol);

    // Check if the ticker data was successfully fetched
    if (ticker) {
      // Extract the current price
      const currentPriceKRW = ticker.last;
      console.log("1717", currentPriceKRW);
      console.log("1718", currentPriceKRW.toFixed(10));

      // Return the current price in KRW
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
    console.log("discord sent");
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
