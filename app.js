const cors = require("cors");
const express = require("express");
const pool = require("./db/dbConfig");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const sgMail = require("@sendgrid/mail");
const PDFDocument = require("pdfkit");
const fs = require("fs");
// const { promisify } = require("util");
// const writeFileAsync = promisify(fs.writeFile);
const { body, validationResult } = require("express-validator");
const loginController = require("./controllers/loginController");
const registerController = require("./controllers/registerController");
const app = express();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.use(cors());
app.use((req, res, next) => {
  if (req.originalUrl === "/stripe-webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

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
const getCharityStripeAccountId = async (charityId) => {
  try {
    const queryText = "SELECT stripe_account_id FROM charities WHERE id = $1";
    const queryValues = [charityId];
    const res = await pool.query(queryText, queryValues);
    if (res.rows.length > 0) {
      return res.rows[0].stripe_account_id;
    } else {
      throw new Error("Charity not found with ID: " + charityId);
    }
  } catch (err) {
    console.error("Error querying the database:", err);
    throw err;
  }
};

// Function to retrieve a charity's name by ID
const getCharityNameById = async (charityId) => {
  try {
    const result = await pool.query(
      "SELECT name FROM charities WHERE id = $1",
      [charityId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].name;
    } else {
      throw new Error("Charity name not found for ID: " + charityId);
    }
  } catch (err) {
    console.error("Error fetching charity name:", err);
    throw err;
  }
};

const sendDonationConfirmationEmail = async (
  userEmail,
  charityId,
  amount,
  firstName,
  lastName,
  donationFrequency
) => {
  try {
    const donorName = `${firstName} ${lastName}`;
    const charityName = await getCharityNameById(charityId);
    if (!charityName) {
      throw new Error(`Charity with ID ${charityId} not found.`);
    }
    const frequencyMessage =
      donationFrequency === "monthly" ? "monthly" : "one-time";

    // Generate PDF
    const doc = new PDFDocument();
    const pdfPath = `receipt_${Date.now()}.pdf`;
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // PDF content
    doc.fontSize(22).text("Donation Receipt", { align: "center" });
    doc.moveDown();

    doc.fontSize(16).text(`Donor Name: ${donorName}`, { align: "left" });
    doc.text(`Charity Name: ${charityName}`, { align: "left" });
    doc.text(`Donation Amount: $${amount}`, { align: "left" });
    doc.text(`Donation Date: ${new Date().toLocaleDateString()}`, {
      align: "left",
    });
    doc.text(`Donation Frequency: ${frequencyMessage}`, { align: "left" });
    // If you have an actual donation number or other details, add them here.
    // doc.text(`Receipt for your ${donationFrequency} donation`, {
    //   align: "center",
    // });
    // // ... add more content to your PDF ...

    // Finalize PDF file
    doc.end();
    await new Promise((resolve) => stream.on("finish", resolve));

    // Read the PDF into a buffer
    const pdfBuffer = fs.readFileSync(pdfPath);
    const message = {
      to: userEmail,
      from: "change4change.pursuit@gmail.com",
      subject: "Donation Confirmation and Receipt",
      text: `Dear ${donorName}, Thank you for your ${frequencyMessage} donation of $${amount} to ${charityName}.`,
      attachments: [
        {
          content: pdfBuffer.toString("base64"),
          filename: "DonationReceipt.pdf",
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
      html: `
          <html>
            <head>
              <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
              .header { background-color: #ff7300; padding: 10px; text-align: center; color: white; }
              .content { margin: 20px; background-color: white; padding: 20px; }
              .footer { background-color: #f4f4f4; padding: 10px; text-align: center; }
              .donation-info { background-color: #e6e6e6; padding: 10px; }
              .button {
                display: block; /* Block display will allow the button to respect the margin auto */
                width: calc(25% - 20px); /* Full width minus the padding from the container */
                background-color: #551aeb;
                color: white !important;
                border: none;
                border-radius: 3px;
                padding: 10px 15px;
                cursor: pointer;
                margin: 10px auto; /* Top and bottom margin of 10px and auto margin on the sides */
                transition: background-color 0.3s ease;
                text-decoration: none !important;
                text-align: center; /* Centers the text inside the button */
              }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>change 4 change</h1>
              </div>
              <div class="content">
                <p><strong>${donorName} thank you for your donation!</strong></p>
                <div class="donation-info">
                  <p>Your support is making a difference in the lives of many.</p>
                  <p>You have donated <strong>$${amount}</strong> with fees included to <strong>${charityName}</strong></p>
                  <p>Charged Amount: $${amount}</p>
                  <p>Donation Date: ${new Date().toLocaleDateString()}</p>
                  <p>Donation Number: ${Math.floor(
                    Math.random() * 100000000
                  )}</p>
                </div>
                <p>Your official receipt is attached to this email</p>
              </div>
              <div class="footer">
                <p>If you have any questions, please don't hesitate to contact us.</p>
                <a href="https://change-4-change-frontend.onrender.com/connect-us" style="color: white; text-decoration: none;" class="button">Contact Us</a>
                </div>
            </body>
          </html>
        `,
    };
    await sgMail.send(message);
    console.log("Confirmation email with PDF receipt sent");
    // Optionally delete the temporary PDF file
    fs.unlinkSync(pdfPath);
  } catch (error) {
    console.error("Error in sendDonationConfirmationEmail:", error);
    // Handle or log the error as appropriate
  }
};

app.post("/login", loginController.login);
app.post("/register", registerController.register);

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
    // console.log("Received Charity ID:", charityId); // Log the received charity ID
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Proceed with your existing logic if validation passed
    const {
      amount,
      currency,
      charityId,
      paymentMethodId,
      email,
      donationFrequency,
      firstName,
      lastName,
    } = req.body;
    console.log(
      amount,
      currency,
      charityId,
      paymentMethodId,
      email,
      donationFrequency
    );
    try {
      // Create a Customer first if not exists
      const customer = await stripe.customers.create({ email });
      const charityStripeAccountId = await getCharityStripeAccountId(charityId);
      console.log("Charity ID:", charityId); // Log to check the charity ID
      // Attach the Payment Method to the Customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });
      // Update Customer's default method
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
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
              charityId, // The name of the charity they donated to, from the request body
              amount, // The amount they donated, from the request body
              firstName,
              lastName,
              donationFrequency // Pass this variable
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
      } else if (donationFrequency === "monthly") {
        // Ensure you have a price ID set up for monthly donations in Stripe
        const priceId = process.env.STRIPE_PRICE_ID; // Retrieve the Stripe price ID for monthly subscriptions from environment variables
        if (!priceId) {
          res.status(400).json({
            error: "Stripe price ID for monthly donations is not set.",
          });
          return;
        }
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          default_payment_method: paymentMethodId,
          transfer_data: { destination: charityStripeAccountId }, // Direct payment to the charity's Stripe account
          expand: ["latest_invoice.payment_intent"], // Include the PaymentIntent in the response
          metadata: {
            charity_id: charityId,
            donation_frequency: donationFrequency, // Set from the request to "monthly"
          },
        });
        // Check if the subscription is created successfully
        if (
          subscription.status === "active" ||
          subscription.status === "succeeded"
        ) {
          // Insert subscription details into the database
          const insertText = `
          INSERT INTO transactions (
            charity_id, 
            amount, 
            currency, 
            donation_frequency, 
            stripe_transaction_id, 
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;
          const insertValues = [
            charityId,
            // Use the amount from the corresponding price object, or a pre-defined amount
            // Ensure this matches your data type and scale in the database
            amount,
            currency,
            donationFrequency,
            subscription.id, // Use the subscription ID here for reference
            new Date().toISOString(), // Use the current time for the subscription start
          ];
          try {
            await pool.query(insertText, insertValues);
            console.log("Subscription recorded in the database.");
            const monthlyAmount = insertValues[1]; // amount from the insertValues
            await sendDonationConfirmationEmail(
              email,
              charityId,
              monthlyAmount,
              firstName,
              lastName,
              donationFrequency // Pass this variable
            );
            console.log("Monthly donation confirmation email sent.");
            res.json({
              message:
                "Monthly donation set up successfully. Confirmation email sent!",
              clientSecret:
                subscription.latest_invoice.payment_intent.client_secret,
              status: subscription.latest_invoice.payment_intent.status,
            });
          } catch (err) {
            console.error(
              "Error inserting subscription transaction into database:",
              err
            );
            res.status(500).json({ error: "An internal error occurred." });
          }
        } else {
          // Handle cases where subscription creation was not successful
          console.error(
            "Subscription creation failed with status:",
            subscription.status
          );
          res.status(400).json({ error: "Failed to create subscription" });
          return;
        }
        console.log("Added subscription");
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
    try {
      const event = stripe.webhooks.constructEvent(
        request.body,
        request.headers["stripe-signature"],
        process.env.STRIPE_ENDPOINT_SECRET
      );
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          // Extract donation frequency from the metadata. If not present, log an error or handle as appropriate.
          const donationFrequency = paymentIntent.metadata.donation_frequency;
          if (!donationFrequency) {
            console.error(
              "Donation frequency not set in payment intent metadata."
            );
            // You should handle this case appropriately, perhaps by setting a default value or rejecting the transaction.
          }
          // Extract charity_id from the metadata. If not present, log an error or handle as appropriate.
          const charityId = paymentIntent.metadata.charity_id;
          if (!charityId) {
            console.error("Charity ID not set in payment intent metadata.");
            // You should handle this case appropriately, perhaps by setting a default value or rejecting the transaction.
          }
          // Prepare the SQL query.
          const insertText = `
              INSERT INTO transactions (
                charity_id, 
                amount, 
                currency, 
                donation_frequency, 
                stripe_transaction_id, 
                created_at
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `;
          // Prepare the values for SQL query.
          const insertValues = [
            charityId, // Retrieved from paymentIntent metadata.
            paymentIntent.amount / 100, // Convert amount from cents to dollars.
            paymentIntent.currency,
            donationFrequency, // Retrieved from paymentIntent metadata.
            paymentIntent.id, // Stripe transaction ID.
            new Date(paymentIntent.created * 1000).toISOString(), // Convert Stripe's created timestamp (in seconds) to ISO string.
          ];
          // Execute the SQL query.
          try {
            await pool.query(insertText, insertValues);
            console.log("Transaction recorded for one-time payment.");
          } catch (error) {
            console.error("Error inserting transaction into database:", error);
            // Handle the database error as appropriate.
          }
          break;
        }
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          try {
            const customer = await stripe.customers.retrieve(invoice.customer);
            const charityId = customer.metadata.charity_id;
            if (!charityId) {
              console.error("Charity ID not found in customer metadata.");
              // Handle this case as needed.
            }
            const stripeTransactionId = invoice.payment_intent || invoice.id; // Fallback to invoice ID if payment_intent is null.
            const insertText = `
                INSERT INTO transactions (
                  charity_id, 
                  amount, 
                  currency, 
                  donation_frequency, 
                  stripe_transaction_id, 
                  created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `;
            const insertValues = [
              charityId,
              invoice.amount_paid / 100, // Convert from cents
              invoice.currency,
              "monthly",
              stripeTransactionId,
              new Date(invoice.created * 1000).toISOString(), // Convert from UNIX timestamp to ISO string
            ];
            await pool.query(insertText, insertValues);
          } catch (error) {
            console.error("Error handling invoice.payment_succeeded:", error);
            // Handle the error appropriately.
          }
          break;
        }
        case "payment_intent.payment_failed":
          // Business logic for payment intent payment failed
          break;
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
      response.json({ received: true }); // Acknowledge receipt of the event
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`, err.stack);
      if (!response.headersSent) {
        response.status(400).send(`Webhook Error: ${err.message}`);
      }
    }
  }
);

app.get("*", (req, res) => {
  res.status(404).send("Page not found");
});

module.exports = app;
