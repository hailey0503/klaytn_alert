require("dotenv").config();
const ethers = require('ethers');
const winston = require('../winston.js')
const { userClient, bearer} = require('../twitterClient.js')

async function main() {
  //const wsUrl = "wss://klaytn01.fautor.app/ws/";
  const wsUrl = process.env.wsUrl;
  //console.log(wsUrl)
  winston.warn(wsUrl);
  const networkId = 8217;
  

  const provider = new ethers.providers.WebSocketProvider(
    wsUrl,
    networkId
  );
  
  // subscribe new block
	const txHash = "0x49468068623729f891030014f336727df3e494da3697f510683986d606be8d33"
 
    const thisTx = await provider.getTransaction(txHash);
    //const transactions = result.transactions;
    
    //var len = transactions.length;
    //console.log(len);
    //winston.debug(len);

   
      const value = thisTx["value"];
      const whaleThreshold = ethers.utils.parseEther( "10" );

      if (value.gte(whaleThreshold)) {
        const fromAddress = thisTx["from"];
        const toAddress = thisTx["to"];
        const walletFromName = await fetchWalletInfo(fromAddress);
        const walletToName = await fetchWalletInfo(toAddress);
		const link = "https://scope.klaytn.com/tx/" + txHash
        tweet(`${ethers.utils.formatEther(value)}Klay is transfered to ${walletToName} from ${walletFromName} Link: ${link}`)

        }
      


}

async function fetchWalletInfo(address) {

  const klaytnScope = "https://api-cypress-v3.scope.klaytn.com/v2/accounts/";
  const res= await fetch(klaytnScope + address);
  const resJson= await res.json();
  const walletInfo = resJson.result;
  const addressShort = address.slice(0, 7) + "..." + address.slice(37,42);
  const walletName = (walletInfo.addressName || addressShort);
  winston.debug("from_wallet_name: " + walletName);
  return walletName

}

async function tweet(arg) {
  try {
    await userClient.v2.tweet(arg)
  } catch(e) {
    console.error(e)
  }
}

main()
  .then(/*() => process.exit(0)*/)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
