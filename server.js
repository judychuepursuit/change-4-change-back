
// DEPENDENCIES
const app = require("./app.js");

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const pool = require('./db/dbConfig'); 
const { body, validationResult } = require('express-validator'); // Import the necessary functions


app.use(cors());


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/transactions', bodyParser.json(), async (req, res) => {
  try {
    console.log("fetching transaction")
    const result = await pool.query(
      `SELECT t.amount, t.currency, t.donation_frequency, c.name, t.created_at
      FROM transactions t 
      JOIN charities c ON t.charity_id = c.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error retrieving transactions', err);
    res.status(500).json({ message: 'Error retrieving transactions' });
  }
});

// Function to retrieve a charity's Stripe account ID
const getCharityStripeAccountId = async (charityName) => {
  console.log(charityName)
  try {
    const queryText = 'SELECT stripe_account_id FROM charities WHERE name = $1';
    const queryValues = [charityName];
    const res = await pool.query(queryText, queryValues);
    if (res.rows.length > 0) {
      return res.rows[0].stripe_account_id;
    } else {
      throw new Error('Charity not found');
    }
  } catch (err) {
    console.error('Error querying the database:', err);
    throw err;
  }
};

app.post('/create-payment-intent', bodyParser.json(), 
  // Validation middleware
  [
    body('amount').isNumeric().withMessage('Amount must be numeric.'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code.'),
    body('email').isEmail().withMessage('Email must be valid.'),
    body('donationFrequency').isIn(['one-time', 'monthly']).withMessage('Invalid donation frequency.'),
    // Add additional validation as needed
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Proceed with your existing logic if validation passed
    const { amount, currency, charityName, paymentMethodId, email, donationFrequency } = req.body;
    console.log(amount, currency, charityName, paymentMethodId, email, donationFrequency)
  try {
    // Create a Customer first if not exists
    const customer = await stripe.customers.create({ email });

    const sanitizedCharityName = charityName.trim();
    const charityStripeAccountId = await getCharityStripeAccountId(sanitizedCharityName);
    const charityIdRes = await pool.query("SELECT id FROM charities WHERE name = $1", [charityName]);
    const charityId = charityIdRes.rows[0].id;

    console.log("Charity ID:", charityId); // Log to check the charity ID


    // Validate and sanitize the charityName before querying the database
    if (typeof charityName !== 'string' || charityName.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid charity name' });
    }
    // Attach the Payment Method to the Customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    // Update Customer's default method
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // let clientSecret;
    if (donationFrequency === 'one-time') {
      // For one-time payments
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Convert amount to cents
        currency,
        customer: customer.id,
        payment_method: paymentMethodId, // Make sure this matches the POST body variable name
        confirmation_method: 'manual',
        confirm: true,
        transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
        return_url: 'http://localhost:3000/payment-success', // Adjust the URL as needed
        metadata: {
          charity_id: charityId,
          donation_frequency: donationFrequency
        }
      });
      // Send back the client secret and the status of the payment intent
      res.json({ 
        clientSecret: paymentIntent.client_secret, 
        status: paymentIntent.status 
      });
    } else {
        // For recurring subscriptions
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: process.env.STRIPE_PRICE_ID }],
          default_payment_method: paymentMethodId,
          transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
          expand: ['latest_invoice.payment_intent'], // Include the PaymentIntent in the response
        });
      res.json({
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        status: subscription.latest_invoice.payment_intent.status
      });  
    }

    // console.log(clientSecret);
  } catch (err) {
    console.error('Error occurred while creating payment intent or subscription:', err);
    // Check if headers have already been sent to avoid ERR_HTTP_HEADERS_SENT
    if (!res.headersSent) {
      res.status(500).json({ message: 'An error occurred', error: err.message });
    }
    }
  }
);

// Stripe Webhook handling
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  // let event;

  try {
    const event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_ENDPOINT_SECRET);
  // } catch (err) {
  //   console.error(`Webhook Error: ${err.message}`);
  //   return response.status(400).send(`Webhook Error: ${err.message}`);
  // }

  // Handle the event
  switch (event.type) {
    // case 'charge.succeeded':
    case 'payment_intent.succeeded':
      {
        console.log(event.type)
        // Business logic for payment intent succeeded
        const paymentIntent = event.data.object;
        // Extracting donation frequency from metadata or determining it some other way
        const donationFrequency = paymentIntent.metadata.donation_frequency || 'one-time';
        // Insert into your database (example query, adjust accordingly)
        const insertText = 'INSERT INTO transactions(charity_id, amount, currency, donation_frequency, stripe_payment_intent_id) VALUES($1, $2, $3, $4, $5)';
        const insertValues = [
          paymentIntent.metadata.charity_id,
          paymentIntent.amount / 100, // Convert from cents
          paymentIntent.currency,
          donationFrequency, // Use the extracted or default value
          paymentIntent.id
        ];
        try {
          await pool.query(insertText, insertValues);
          console.log("inserttext insertvalues")
        } catch (insertErr) {
          console.error('Error saving to database:', insertErr);
          // Decide how you want to handle errors
        }
        break;
      }
    case 'invoice.payment_succeeded':
      // Business logic for invoice payment succeeded
      break;
    case 'payment_intent.payment_failed':
      // Business logic for payment intent payment failed
      break;
    case 'payment_method.attached':
      // Business logic for payment method attached
      break;
    default:
      // Handle other event types
      console.log(`Unhandled event type ${event.type}`);
  }
  // Return a response to acknowledge receipt of the event
  response.json({ received: true });
} catch (err) {
  console.error(`Webhook Error: ${err.message}`);
  response.status(400).send(`Webhook Error: ${err.message}`);
}

});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});


