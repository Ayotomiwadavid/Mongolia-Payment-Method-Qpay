const express = require('express');
const bodyParser = require("body-parser");
const axios = require('axios');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));

// parse application/json
app.use(bodyParser.json());

app.use(express.json());

// Prepare WebSocket server
const wss = new WebSocket.Server({noServer: true});

let connectedClients = [];

let accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJmZDNiYzQ3ZC0xNjAwLTQwYzUtYWFhOC0zNTZmNDMzNmEyODQiLCJzZXNzaW9uX2lkIjoiMmFBU3d1c0hBWGtIZ3JMQl9uVHQtZDI4eE5RWnlKTTkiLCJpYXQiOjE3MzIyMzkwNzQsImV4cCI6MzQ2NDU2NDU0OH0.JSn0szkofW8eTropM3tade_0xkcCmKTCpLLK0NeJukQ";

// Listen for WebSocket connections
wss.on('connection', (ws) => {
    console.log("Client connected via WebSocket");
    connectedClients.push(ws);

    ws.on('close', () => {
        console.log("Client disconnected");
        connectedClients = connectedClients.filter(client => client !== ws);
    });
});

// Helper function to broadcast messages to all connected clients
function broadcastMessage(message) {
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Function to request a new token
async function requestNewToken() {
    const authString = `${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`;

    const encodedAuth = Buffer.from(authString).toString('base64');

    try {
        const response = await axios.post('https://merchant.qpay.mn/v2/auth/token', {}, {
            headers: {
                'Authorization': `Basic ${encodedAuth}`
            }
        });

        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000); // Convert to milliseconds
        console.log('New token generated:', accessToken);

    } catch (error) {
        console.error('Error requesting new token:', error.response?.data || error.message);
    }
}


// Middleware function to check token validity before each API request
// const ensureValidToken = async () => {
//     if (!accessToken || Date.now() >= tokenExpiry) {
//         console.log('that has expired!!')
//         await requestNewToken();
//     }
// }

// Invoice creation endpoint
app.post('/create-payment', async (req, res) => {

    const {
        senderInvoiceNo,
        invoiceReceiver,
        invoiceDescription,
        invoiceCode,
        amount,
        customerName,
        customerEmail,
        PhoneNumber
    } = req.body

    if (!senderInvoiceNo || !invoiceReceiver || !invoiceDescription || !invoiceCode || !amount || !customerName || !customerEmail || !PhoneNumber) {
        return res.status(400).send({
            error: 'Please include all parameters',
            message: "senderInvoiceNo, invoiceReceiver, invoiceDescription, invoiceCode, amount, customerName, customerEmail, PhoneNumber are required"
        })
    }

    const payload = {
        sender_invoice_no: senderInvoiceNo,
        invoice_receiver_code: invoiceReceiver,
        invoice_description: invoiceDescription,
        invoice_code: "TEST_INVOICE",
        amount: amount,
        callback_url: `${process.env.Base_URL}payment-notification?customerId=${senderInvoiceNo}`,
        receiverData: {
            register: "UZ96021105",
            name: customerName,
            email: customerEmail,
            phone: PhoneNumber
        }
    };

    try {
        // Send POST request to QPay API
        const response = await axios.post(`https://merchant.qpay.mn/v2/invoice`, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            }
        });

        console.log(response.data);
        return res.json({
            response: response.data,
            message: 'Payment Initialized'
        });

    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({error: 'Payment creation failed', message: error.message});
    }
});

// Payment notification endpoint
app.post('/payment-notification', async (req, res) => {
    const customerId = req.query.customerId || req.body.sender_invoice_no;
    const paymentStatus = req.body.payment_status;

    if (customerId) {
        console.log(`Payment notification received for customer ID: ${customerId}`);
        console.log(`Payment status: ${paymentStatus}`);

        // Notify connected clients about the payment status update
        broadcastMessage({
            customerId,
            paymentStatus,
            message: 'Payment status updated'
        });

        // Respond to QPay to confirm notification receipt
        return res.status(200).json({success: true});
    } else {
        return res.status(400).json({error: "Customer ID missing"});
    }
});

// Set up server and WebSocket
const PORT = 8080;
const server = app.listen(PORT, () => {
    console.log('Server is running on PORT ' + PORT);
});

// Upgrade HTTP server to handle WebSocket connections
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});