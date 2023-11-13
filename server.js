// require('dotenv').config();
// test 
// const express = require('express');
// const bodyParser = require('body-parser');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const cors = require('cors');
// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// app.get('/', (req, res) => {
//     res.send('Hello World!');
//   });
  

// app.post('/payment', async (req, res) => {
//     console.log('Payment request received:', req.body);

//     try {
//         // const { paymentMethodId, amount, name, email } = req.body;
//         const { paymentMethodId, amount, firstName, lastName, email } = req.body;


//         if (!paymentMethodId) {
//             res.status(400).json({ error: 'PaymentMethodId is required' });
//             return;
//         }

//         // const paymentIntent = await stripe.paymentIntents.create({
//         //     amount: 1099, // replace with the actual amount
//         //     currency: 'usd', // replace with the actual currency if different
//         //     automatic_payment_methods: {
//         //       enabled: true,
//         //       allow_redirects: 'never',
//         //     },
//         //   });

//         const paymentIntent = await stripe.paymentIntents.create({
//           amount: amount, // amount is expected to be in cents
//           currency: 'usd',
//           payment_method: paymentMethodId,
//           confirmation_method: 'manual',
//           confirm: true,
//           return_url: 'http://localhost:3000/payment-success', // You need to provide a return URL where Stripe should redirect after payment
//           // if you have a customer ID, you should include that as well
//           // customer: customerId,
//       });


//         res.json({ success: true, paymentIntent });
//     } catch (err) {
//         console.error("Error during payment process:", err);
//         res.status(500).json({ error: err.message });
//     }
// });

// app.post('/create-payment-link', async (req, res) => {
//   try {
//     const { productName, amount } = req.body;

//     // First, create a product
//     const product = await stripe.products.create({
//       name: productName,
//     });

//     // Then, create a price for that product
//     const price = await stripe.prices.create({
//       unit_amount: amount,
//       currency: 'usd',
//       product: product.id, // Use the product ID from the product you just created
//     });

//     // Now, create a payment link with the price ID
//     const paymentLink = await stripe.paymentLinks.create({
//       line_items: [{
//         price: price.id, // Use the price ID from the price you just created
//         quantity: 1,
//       }],
//     });

//     res.json({ url: paymentLink.url });
//   } catch (err) {
//     console.error("Error during payment link creation:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


// const PORT = process.env.PORT || 3001;

// app.listen(PORT, () => {
//     console.log(`Server started on port ${PORT}`);
// });


















// require('dotenv').config();

// const express = require('express');
// const bodyParser = require('body-parser');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const cors = require('cors');

// const app = express();

// app.use(cors());
// app.use(bodyParser.json());

// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });

// app.post('/payment', async (req, res) => {
//   try {
//     const { paymentMethodId, amount, firstName, lastName, email } = req.body;

//     if (!paymentMethodId || !amount || !email) {
//       return res.status(400).json({ error: 'Payment method, amount, and email are required.' });
//     }

//     // Ensure amount is in cents
//     const paymentAmount = parseInt(amount) * 100;

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: paymentAmount,
//       currency: 'usd',
//       payment_method: paymentMethodId,
//       confirmation_method: 'manual',
//       confirm: true,
//       // Use environment variable for production deployment
//       return_url: process.env.SUCCESS_URL || 'http://localhost:3000/payment-success',
//     });

//     res.json({ success: true, paymentIntentId: paymentIntent.id });
//   } catch (err) {
//     console.error("Error during payment process:", err);
//     // Don't send error details to the client in production for security reasons
//     res.status(500).json({ error: 'An error occurred while processing your payment.' });
//   }
// });

// app.post('/create-payment-link', async (req, res) => {
//   try {
//     const { productName, amount } = req.body;

//     if (!productName || !amount) {
//       return res.status(400).json({ error: 'Product name and amount are required.' });
//     }

//     // Ensure amount is in cents
//     const productAmount = parseInt(amount) * 100;

//     const product = await stripe.products.create({
//       name: productName,
//     });

//     const price = await stripe.prices.create({
//       unit_amount: productAmount,
//       currency: 'usd',
//       product: product.id,
//     });

//     const paymentLink = await stripe.paymentLinks.create({
//       line_items: [{
//         price: price.id,
//         quantity: 1,
//       }],
//     });

//     res.json({ url: paymentLink.url });
//   } catch (err) {
//     console.error("Error during payment link creation:", err);
//     res.status(500).json({ error: 'An error occurred while creating the payment link.' });
//   }
// });

// // Handle unhandled promise rejections to prevent crashing
// process.on('unhandledRejection', (error) => {
//   console.error('Unhandled Rejection:', error);
//   // Application specific logging, throwing an error, or other logic here
// });

// const PORT = process.env.PORT || 3001;

// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
// });





















require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/payment', async (req, res) => {
    try {
        const { paymentMethodId, amount, firstName, lastName, email } = req.body;

        // Validate request body
        if (!paymentMethodId || !amount || !firstName || !lastName || !email) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Convert amount to the smallest currency unit, e.g., cents
        const paymentAmount = Math.round(parseFloat(amount) * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: paymentAmount,
            currency: 'usd',
            payment_method: paymentMethodId,
            confirmation_method: 'manual',
            confirm: true,
            // Use a environment-specific URL for production
            return_url: process.env.SUCCESS_URL || 'http://localhost:3000/payment-success',
        });

        // Only send necessary data to the client
        res.json({ success: true, paymentIntentId: paymentIntent.id });
    } catch (err) {
        console.error("Payment error:", { error: err.message }); // Masked sensitive data from logs
        res.status(500).json({ error: 'An error occurred while processing the payment.' });
    }
});

// app.post('/create-payment-link', async (req, res) => {
//     try {
//         const { productName, amount } = req.body;

//         if (!productName || !amount) {
//             return res.status(400).json({ error: 'Product name and amount are required.' });
//         }

//         // Convert amount to the smallest currency unit, e.g., cents
//         const productAmount = Math.round(parseFloat(amount) * 100);

//         // You would typically have product and price creation in an admin interface, not in the payment flow
//         const product = await stripe.products.create({
//             name: productName,
//         });

//         const price = await stripe.prices.create({
//             unit_amount: productAmount,
//             currency: 'usd',
//             product: product.id,
//         });

//         const paymentLink = await stripe.paymentLinks.create({
//             line_items: [{ price: price.id, quantity: 1 }],
//         });

//         res.json({ url: paymentLink.url });
//     } catch (err) {
//         console.error("Payment link error:", { error: err.message });
//         res.status(500).json({ error: 'An error occurred while creating the payment link.' });
//     }
// });

// app.post('/create-payment-link', async (req, res) => {
//     try {
//         const { productName, amount } = req.body;

//         if (!productName || !amount) {
//             return res.status(400).json({ error: 'Product name and amount are required.' });
//         }

//         // Ensure the amount is in cents and is a valid number
//         const productAmount = Math.round(Number(amount) * 100);
//         if (isNaN(productAmount)) {
//             return res.status(400).json({ error: 'Invalid amount provided.' });
//         }

//         // Create a product or look up the product by name if already created
//         let product = await stripe.products.list({ name: productName });
//         if (!product.data.length) {
//             product = await stripe.products.create({ name: productName });
//         } else {
//             product = product.data[0]; // Use the existing product
//         }

//         // Create a price for the product
//         const price = await stripe.prices.create({
//             unit_amount: productAmount,
//             currency: 'usd',
//             product: product.id,
//         });

//         // Create the payment link
//         const paymentLink = await stripe.paymentLinks.create({
//             line_items: [{ price: price.id, quantity: 1 }],
//         });

//         res.json({ url: paymentLink.url });
//     } catch (err) {
//         console.error("Payment link error:", err);
//         res.status(500).json({ error: 'An error occurred while creating the payment link.' });
//     }
// });

// app.post('/create-payment-link', async (req, res) => {
//   try {
//     const { productName, amount } = req.body;

//     if (!productName || !amount) {
//       return res.status(400).json({ error: 'Product name and amount are required.' });
//     }

//     // Ensure amount is in cents
//     const productAmount = parseInt(amount) * 100;

//     const product = await stripe.products.create({
//       name: productName,
//     });

//     const price = await stripe.prices.create({
//       unit_amount: productAmount,
//       currency: 'usd',
//       product: product.id,
//     });

//     const paymentLink = await stripe.paymentLinks.create({
//       line_items: [{
//         price: price.id,
//         quantity: 1,
//       }],
//     });

//     res.json({ url: paymentLink.url });
//   } catch (err) {
//     console.error("Error during payment link creation:", err);
//     res.status(500).json({ error: 'An error occurred while creating the payment link.' });
//   }
// });

// Handle unhandled promise rejections
process.on('unhandledRejection', (error, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', error);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

