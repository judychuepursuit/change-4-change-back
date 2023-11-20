// require('dotenv').config();

// const express = require('express');
// const bodyParser = require('body-parser');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const cors = require('cors');

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// app.get('/', (req, res) => {
//     res.send('Hello World!');
// });

// // One-time Payment Endpoint
// app.post('/create-payment-intent', async (req, res) => {
//   const { amount, currency, payment_method, return_url } = req.body; // include return_url in the request body

//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount,
//       currency,
//       payment_method: payment_method,
//       confirm: true,
//       return_url, // specify the return_url for redirect after payment
//     });
//     res.status(200).send({ clientSecret: paymentIntent.client_secret });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// // Subscription Endpoint with Payment Method Attachment
// app.post('/create-subscription', async (req, res) => {
//   const { customerId, paymentMethodId } = req.body; // Include paymentMethodId in the request body
//   const priceId = 'price_1OC7w8Kw0bozpjFOGDdJwjGE';

//   try {
//     // Attach the Payment Method to the Customer
//     const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
//       customer: customerId,
//     });
    
//     // Set the default Payment Method for the Customer
//     await stripe.customers.update(customerId, {
//       invoice_settings: {
//         default_payment_method: paymentMethod.id,
//       },
//     });

//     // Create the Subscription
//     const subscription = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: priceId }],
//       expand: ['latest_invoice.payment_intent'],
//     });

//     res.status(200).send({
//       subscriptionId: subscription.id,
//       clientSecret: subscription.latest_invoice.payment_intent.client_secret,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Endpoint to create a new Stripe customer
// app.post('/create-customer', async (req, res) => {
//   const { email } = req.body;

//   try {
//       const customer = await stripe.customers.create({
//           email,
//       });

//       res.status(200).json({ customerId: customer.id });
//   } catch (err) {
//       res.status(500).json({ error: err.message });
//   }
// });

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (error, promise) => {
//     console.error('Unhandled Rejection at:', promise, 'reason:', error);
// });

// const PORT = process.env.PORT || 3001;

// app.listen(PORT, () => {
//     console.log(`Server started on port ${PORT}`);
// });







require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const pool = require('./db/dbConfig'); // Assuming dbConfig.js is in a folder named db

const app = express();

app.use(cors());
app.use(bodyParser.json());



// Function to retrieve a charity's Stripe account ID
const getCharityStripeAccountId = async (charityName) => {
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

app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency, charityName, paymentMethodId, email, donationFrequency } = req.body;

  try {
    // Create a Customer first if not exists
    const customer = await stripe.customers.create({ email });

    const charityStripeAccountId = await getCharityStripeAccountId(charityName);
    // ... your code to create a payment intent using charityStripeAccountId ...


    // Attach the Payment Method to the Customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    
    // Update Customer's default method
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    let paymentIntent;
    if (donationFrequency === 'one-time') {
      // For one-time payments
      paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // Convert amount to cents
        currency,
        customer: customer.id,
        payment_method: paymentMethodId, // Make sure this matches the POST body variable name
        confirmation_method: 'manual',
        confirm: true,
        transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
      });
    } else {
      // For recurring subscriptions
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.STRIPE_PRICE_ID }], // Your Stripe Price ID for recurring payments
        transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
      });
      paymentIntent = await stripe.paymentIntents.retrieve(
        subscription.latest_invoice.payment_intent
      );
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error occurred while creating payment intent or subscription:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});



