import mongoose from 'mongoose';


const Schema = mongoose.Schema;
const transaction = new Schema({
	blockchainName: {
		type: String,
		required: true
	},	
	timestamp: {
		type: Date(),
		required: true
	},
	txHash: {
		type: String,
		required: true
	},
	fee: {
		type: Number,
		required: true
	},
	sender: {
		type: String,
		required: true
	},
	
	receiver: {
		type: String,
		required: true
	},
	amount: {
		type: String,
		required: true
	},
	
});

export default mongoose.model("TX", transaction);