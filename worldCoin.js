require("dotenv").config();
const ethers = require("ethers");
const winston = require("./winston.js");
const { userClient } = require("./twitterClient.js");
const { sendMessage } = require("./telegram.js")
const fs = require('fs');

const result = JSON.parse(fs.readFileSync('./data/accountLabels.json'));
//console.log(result)

async function main() {
  const wsETHUrl = process.env.wsETHUrl;
  winston.warn(wsETHUrl);
  const networkId = 1;

  const provider = new ethers.providers.WebSocketProvider(wsETHUrl, networkId);

  const abi = [
    // Read-Only Functions
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    // Authenticated Functions
    "function transfer(address to, uint amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint amount)"
];
	const wldAddress = "0x163f8C2467924be0ae7B5347228CABF260318753";
	const erc20 = new ethers.Contract(wldAddress, abi, provider);


  	erc20.on("Transfer", async (from, to, amount, event) => {
    try {
      
        const value = amount;
        const txHash = event.transactionHash; //event tx -> console.log
        const whaleThreshold = ethers.utils.parseEther("50");
		console.log('thres',whaleThreshold)
    console.log(whaleThreshold<value)

        if (value.gte(whaleThreshold)) {
			console.log('in')
          const fromAddress = from;
          const toAddress = to;
		  //console.log('from to',fromAddress, toAddress)
          const walletFromName = getWalletInfo(fromAddress, result);
          const walletToName = getWalletInfo(toAddress, result);
		 //console.log('names',walletFromName, walletToName)
          const link = "https://etherscan.io/tx/" + txHash;
		 // console.log('link',link)
          const message = `${ethers.utils.formatEther(
            value
          )} #WLD is transfered to ${walletToName} from ${walletFromName} ${link}`
          
          const tweetPromise = tweet(
            message
          );
          const telegramPromise = telegram(
            message
          )
          await Promise.all([tweetPromise, telegramPromise]) 
        }
      
    } catch (e) {
      winston.error(e);
    }
  });
}

function getWalletInfo(address, result) {
  console.log("getwallet")

  const addressShort = address.slice(0, 7) + "..." + address.slice(37, 42);
  console.log('short', addressShort)

  console.log('result',result[address])
  const walletName = addressShort
  if (result[address]) {
    walletName = result[address].name
  } 
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
	console.log('www')
    process.exit(1);
  });
