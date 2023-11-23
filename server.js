require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const pool = require('./db/dbConfig'); 
const { body, validationResult } = require('express-validator'); // Import the necessary functions
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.get('/', (req, res) => {
  res.send('Hello World!');
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

app.post('/create-payment-intent', 
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

  try {
    // Create a Customer first if not exists
    const customer = await stripe.customers.create({ email });

    // Validate and sanitize the charityName before querying the database
    if (typeof charityName !== 'string' || charityName.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid charity name' });
    }
    
    const sanitizedCharityName = charityName.trim();
    const charityStripeAccountId = await getCharityStripeAccountId(sanitizedCharityName);

    // const charityStripeAccountId = await getCharityStripeAccountId(charityName);
    // ... your code to create a payment intent using charityStripeAccountId ...

    // Attach the Payment Method to the Customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    
    // Update Customer's default method
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    let clientSecret;
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
      });
      clientSecret = paymentIntent.client_secret;
    } else {
        // For recurring subscriptions
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: process.env.STRIPE_PRICE_ID }],
          default_payment_method: paymentMethodId,
          transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
          expand: ['latest_invoice.payment_intent'], // Include the PaymentIntent in the response
        });
        clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      }

    res.json({ clientSecret });
    console.log(clientSecret);
  } catch (err) {
    console.error('Error occurred while creating payment intent or subscription:', err);
    // Check if headers have already been sent to avoid ERR_HTTP_HEADERS_SENT
    if (!res.headersSent) {
      res.status(500).json({ message: 'An error occurred', error: err.message });
    }
    }
  }
);


app.post('/stripe-webhook', express.raw({type: 'application/json'}), (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_ENDPOINT_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'charge.succeeded':
      // Business logic for charge succeeded
      break;
    case 'invoice.payment_succeeded':
      // Business logic for invoice payment succeeded
      break;
    case 'payment_intent.payment_failed':
      // Business logic for payment intent payment failed
      break;
    case 'payment_intent.succeeded':
      // Business logic for payment intent succeeded
      break;
    case 'payment_method.attached':
      // Business logic for payment method attached
      break;
    default:
      // Handle other event types
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  response.json({received: true});
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});



