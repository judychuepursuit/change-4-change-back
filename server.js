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
    console.log('Payment request received:', req.body);

    try {
        const { paymentMethodId, amount, name, email } = req.body;

        if (!paymentMethodId) {
            res.status(400).json({ error: 'PaymentMethodId is required' });
            return;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1099, // replace with the actual amount
            currency: 'usd', // replace with the actual currency if different
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never',
            },
          });

          // const paymentIntent = await stripe.paymentIntents.create({
          //   amount: amount,
          //   currency: 'usd',
          //   payment_method: paymentMethodId,
          //   confirmation_method: 'manual',
          //   confirm: true,
          // }); 
          
          

        res.json({ success: true, paymentIntent });
    } catch (err) {
        console.error("Error during payment process:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/create-payment-link', async (req, res) => {
  try {
    const { productName, amount } = req.body; // Add more fields as needed

    // Create a Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
    });

    res.json({ url: paymentLink.url });
  } catch (err) {
    console.error("Error during payment link creation:", err);
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});


