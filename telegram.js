require("dotenv").config();
const { json } = require("body-parser");
const express = require('express')


const { TELEGRAM_TOKEN, NGROK_SEVER_URL } = process.env
const TELEGRAM_API=`https://api.telegram.org/bot${TELEGRAM_TOKEN}`
const URI = `/webhook/${TELEGRAM_TOKEN}`
const WEBHOOK_URL = NGROK_SEVER_URL+URI


const sendMessage = async (text) => {
	const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			chat_id: "-1001965548923",
			text: text
		
		})
	})
	console.log('res', await response.json())
	
}

module.exports = { sendMessage }
