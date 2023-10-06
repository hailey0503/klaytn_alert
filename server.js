const Web3 = require('web3');
const web3 = new Web3( process.env.wsUrl);

const tokenContractAddress = '0x089Fa00784cca541409947e9bd098AE816D00822'; // Replace with the actual token contract address
const tokenAbi = []; // Replace with the ABI of the token contract

async function getTopTokenHolders() {
  // Step 2: Retrieve Transfer events
  const tokenContract = new web3.eth.Contract(tokenAbi, tokenContractAddress);
  const transferEvents = await tokenContract.getPastEvents('Transfer', {
    fromBlock: 0, // Starting block
    toBlock: 'latest', // Ending block (or 'pending' for pending transactions)
  });

  // Step 3: Aggregate token balances
  const tokenBalances = {};
  transferEvents.forEach((event) => {
    const { from, to, value } = event.returnValues;
    // Subtract tokens from sender
    tokenBalances[from] = (tokenBalances[from] || 0) - parseInt(value);
    // Add tokens to receiver
    tokenBalances[to] = (tokenBalances[to] || 0) + parseInt(value);
  });

  // Step 4: Sort addresses by token balance
  const sortedAddresses = Object.keys(tokenBalances).sort((a, b) => {
    return tokenBalances[b] - tokenBalances[a];
  });

  // Step 5: Select the top 20 addresses
  const top20Addresses = sortedAddresses.slice(0, 20);

  return top20Addresses;
}

// Step 6: Display or export the list
getTopTokenHolders().then((topAddresses) => {
  console.log('Top 20 Klaytn Token Holders:');
  topAddresses.forEach((address, index) => {
    console.log(`${index + 1}: ${address}`);
  });
});
