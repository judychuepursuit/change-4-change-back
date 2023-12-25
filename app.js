const cors = require("cors");
const express = require("express");
const pool = require("./db/dbConfig");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const sgMail = require("@sendgrid/mail"); // Add this line

const { body, validationResult } = require("express-validator"); // Import the necessary functions

sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Add this line

const app = express();

app.use(cors());

// app.use(express.json());
// Custom middleware to exclude express.json() for the Stripe webhook route
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe-webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

const loginController = require("./controllers/loginController");
const registerController = require("./controllers/registerController");

app.get("/", (req, res) => {
  res.send("Welcome to change4change");
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    const users = result.rows;

    res.json(users);
  } catch (error) {
    console.error("Error in /users route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/login", loginController.login);
app.post("/register", registerController.register);

app.get("/transactions", bodyParser.json(), async (req, res) => {
  try {
    console.log("fetching transaction");
    const result = await pool.query(
      `SELECT t.amount, t.currency, t.donation_frequency, c.name, t.created_at
      FROM transactions t 
      JOIN charities c ON t.charity_id = c.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error retrieving transactions", err);
    res.status(500).json({ message: "Error retrieving transactions" });
  }
});

// Function to retrieve a charity's Stripe account ID
const getCharityStripeAccountId = async (charityName) => {
  console.log(charityName);
  try {
    const queryText = "SELECT stripe_account_id FROM charities WHERE name = $1";
    const queryValues = [charityName];
    const res = await pool.query(queryText, queryValues);
    if (res.rows.length > 0) {
      return res.rows[0].stripe_account_id;
    } else {
      throw new Error("Charity not found");
    }
  } catch (err) {
    console.error("Error querying the database:", err);
    throw err;
  }
};

// Place this function somewhere accessible in your `app.js` file
const sendDonationConfirmationEmail = async (
  userEmail,
  charityName,
  amount,
  firstName,
  lastName
) => {
  const donorName = `${firstName} ${lastName}`;

  const message = {
    to: userEmail,
    from: "change4change.pursuit@gmail.com",
    subject: "Donation Confirmation",
    // text: `Dear ${donorName},\n\nThank you for your donation of $${amount} to ${charityName}.`,
    text: `Dear ${donorName}, Thank you for your donation of $${amount} to ${charityName}.`,

    html: `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .header { background-color: #f4f4f4; padding: 10px; text-align: center; }
          .content { margin: 20px; }
          .footer { background-color: #f4f4f4; padding: 10px; text-align: center; }
          .button { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #007bff; text-align: center; border-radius: 5px; color: white; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Change4Change</h1>
        </div>
        <div class="content">
          <p>Dear ${donorName},</p>
          <p>Thank you for your generous donation of $${amount} to ${charityName}.</p>
          <p>Your support is making a difference in the lives of many.</p>
          <!-- You can add more content here -->
        </div>
        <div class="footer">
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <a href="http://yourwebsite.com/contact" class="button">Contact Us</a>
        </div>
      </body>
    </html>
  `,
  };

  try {
    await sgMail.send(message);
    console.log("Confirmation email sent");
  } catch (error) {
    console.error("Error sending confirmation email:", error);
    throw error; // Or handle the error as needed
  }
};

app.post(
  "/create-payment-intent",
  bodyParser.json(),
  // Validation middleware
  [
    body("amount").isNumeric().withMessage("Amount must be numeric."),
    body("currency")
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be a 3-letter code."),
    body("email").isEmail().withMessage("Email must be valid."),
    body("donationFrequency")
      .isIn(["one-time", "monthly"])
      .withMessage("Invalid donation frequency."),
    // Add additional validation as needed
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Proceed with your existing logic if validation passed
    const {
      amount,
      currency,
      charityName,
      paymentMethodId,
      email,
      donationFrequency,
      firstName,
      lastName,
    } = req.body;
    console.log(
      amount,
      currency,
      charityName,
      paymentMethodId,
      email,
      donationFrequency
    );
    try {
      // Create a Customer first if not exists
      const customer = await stripe.customers.create({ email });

      const sanitizedCharityName = charityName.trim();
      const charityStripeAccountId = await getCharityStripeAccountId(
        sanitizedCharityName
      );
      const charityIdRes = await pool.query(
        "SELECT id FROM charities WHERE name = $1",
        [charityName]
      );
      const charityId = charityIdRes.rows[0].id;

      console.log("Charity ID:", charityId); // Log to check the charity ID

      // Validate and sanitize the charityName before querying the database
      if (typeof charityName !== "string" || charityName.trim().length === 0) {
        return res.status(400).json({ error: "Invalid charity name" });
      }
      // Attach the Payment Method to the Customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      // Update Customer's default method
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // let clientSecret;
      if (donationFrequency === "one-time") {
        // For one-time payments
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // Convert amount to cents
          currency,
          customer: customer.id,
          payment_method: paymentMethodId, // Make sure this matches the POST body variable name
          confirmation_method: "manual",
          confirm: true,
          transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
          return_url: "http://localhost:3000/payment-success", // Adjust the URL as needed
          metadata: {
            charity_id: charityId,
            donation_frequency: donationFrequency,
          },
        });

        if (paymentIntent.status === "succeeded") {
          // The payment was successful, send a confirmation email
          try {
            await sendDonationConfirmationEmail(
              email, // The email address of the user from the request body
              charityName, // The name of the charity they donated to, from the request body
              amount, // The amount they donated, from the request body
              firstName,
              lastName
            );
            // Send a success response back to the client
            res.json({
              message: "Donation successful and email sent!",
              clientSecret: paymentIntent.client_secret,
              status: paymentIntent.status,
            });
          } catch (error) {
            console.error("Payment succeeded but email failed:", error);
            // Payment was successful, but email sending failed
            res.status(500).json({
              message: "Payment succeeded but email notification failed",
            });
          }
        } else {
          // Handle other statuses accordingly
          res
            .status(400)
            .json({ message: "Payment failed", status: paymentIntent.status });
        }
      } else {
        // For recurring subscriptions
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: process.env.STRIPE_PRICE_ID }],
          default_payment_method: paymentMethodId,
          transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
          expand: ["latest_invoice.payment_intent"], // Include the PaymentIntent in the response
          metadata: {
            charity_id: charityId,
            donation_frequency: donationFrequency,
          },
        });
        console.log("added subscription");

        res.json({
          clientSecret:
            subscription.latest_invoice.payment_intent.client_secret,
          status: subscription.latest_invoice.payment_intent.status,
        });
      }

      // console.log(clientSecret);
    } catch (err) {
      console.error(
        "Error occurred while creating payment intent or subscription:",
        err
      );
      // Check if headers have already been sent to avoid ERR_HTTP_HEADERS_SENT
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "An error occurred", error: err.message });
      }
    }
  }
);

// Stripe Webhook handling
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];
    // let event;
    try {
      const event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_ENDPOINT_SECRET
      );
      // } catch (err) {
      //   console.error(`Webhook Error: ${err.message}`);
      //   return response.status(400).send(`Webhook Error: ${err.message}`);
      // }
      // Handle the event
      switch (event.type) {
        // case 'charge.succeeded':
        case "payment_intent.succeeded": {
          console.log(event.type);
          // Business logic for payment intent succeeded
          const paymentIntent = event.data.object;
          // Extracting donation frequency from metadata or determining it some other way
          const donationFrequency =
            paymentIntent.metadata.donation_frequency || "one-time";
          // Insert into your database (example query, adjust accordingly)
          const insertText =
            "INSERT INTO transactions(charity_id, amount, currency, donation_frequency, stripe_payment_intent_id) VALUES($1, $2, $3, $4, $5)";
          console.log(paymentIntent.id);
          console.log(" sripe id found");
          const insertValues = [
            paymentIntent.metadata.charity_id,
            paymentIntent.amount / 100, // Convert from cents
            paymentIntent.currency,
            donationFrequency, // Use the extracted or default value
            paymentIntent.id,
          ];
          try {
            await pool.query(insertText, insertValues);
            console.log("inserttext insertvalues");
          } catch (insertErr) {
            console.error("Error saving to database:", insertErr);
            // Decide how you want to handle errors
          }
          break;
        }
        case "invoice.payment_succeeded":
          // Business logic for invoice payment succeeded
          break;
        case "payment_intent.payment_failed":
          // Business logic for payment intent payment failed
          break;
        case "payment_method.attached":
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
  }
);

app.get("*", (req, res) => {
  res.status(404).send("Page not found");
});

module.exports = app;
