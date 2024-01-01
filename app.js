const cors = require("cors");
const express = require("express");
const path = require("path");
const pool = require("./db/dbConfig");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const sgMail = require("@sendgrid/mail");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const loginController = require("./controllers/loginController");
const registerController = require("./controllers/registerController");
const app = express();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
    const donationAmount = parseFloat(amount);
    const formattedAmount = isNaN(donationAmount)
      ? "0.00"
      : donationAmount.toFixed(2);

    const pdfPath = `receipt_${Date.now()}.pdf`;
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Add your organization's logo and center it on the page
    const pageWidth = doc.page.width; // This will give you the width of the page
    const imageWidth = 150; // The width you want your image to be
    const imageX = pageWidth / 2 - imageWidth / 2; // This will center the image
    doc
      .image("images/logoo.png", imageX, doc.y, { width: imageWidth })
      .moveDown(0.5);

    // Donation Receipt Title
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Donation Receipt", { align: "center" })
      .moveDown(1);

    // Organization Details
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Receipt Number: ${Math.floor(Math.random() * 10000000)}`, {
        align: "left",
      })
      .text(`Organization Name: change 4 change`, { align: "left" })
      .text(`Organization Address: 123 Charity Lane, Suite 100`, {
        align: "left",
      })
      .text(`Federal Tax ID: 12-3456789`, { align: "left" })
      .moveDown(1);

    // Donor Details in a table-like format for clarity
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Donor Name: ${donorName}`, { align: "left" })
      .text(`Charity Name: ${charityName}`, { align: "left" })
      .text(`Donation Amount: $${formattedAmount}`, { align: "left" })
      .text(`Donation Date: ${new Date().toLocaleDateString()}`, {
        align: "left",
      })
      .text(`Donation Frequency: ${donationFrequency}`, { align: "left" })
      .moveDown(1);

    // Thank You Note
    doc
      .fontSize(10)
      .font("Helvetica-Oblique")
      .fillColor("grey")
      .text(
        "Thank you for your generous support. Your donation is greatly appreciated and will be used to help continue our mission.",
        { align: "center" }
      )
      .moveDown(1);

    // Legal Text
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("black")
      .text(
        "This receipt is for charitable contributions and no goods or services were provided in exchange for the donation.",
        { align: "left" }
      )
      .moveDown(1);

    // Signature
    doc
      .image(
        "images/DALL·E 2023-12-31 07.37.45 - A handwritten signature with the name 'Alex Smith'. The signature should look professional and suitable for official documents. It should not resemble.png",
        50,
        doc.y,
        { width: 50 }
      )
      .text("Authorized Signature", 50, doc.y + 20)
      .moveDown(1);

    // Contact Information
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        "If you have any questions, please contact us at: change4change.pursuit@gmail.com or (123) 456-7890.",
        { align: "center" }
      )
      .moveDown(0.5);

    // // Define the width for each icon and the space between the icons
    // const iconWidth = 15;
    // const spaceBetweenIcons = 10;

    // // Calculate the total width that all icons will occupy including the space between them
    // const totalIconsWidth = 3 * iconWidth + 2 * spaceBetweenIcons;

    // // Calculate the center point of the PDF page
    // const centerPoint = doc.page.width / 2;

    // // Calculate the starting X position for the first icon so that the icons as a group are centered
    // const firstIconX = centerPoint - totalIconsWidth / 2;

    // // Place the first social media icon
    // doc.image("images/fb-logo.jpeg", firstIconX, doc.y, { width: iconWidth });

    // // Calculate X position for the second icon and place it
    // const secondIconX = firstIconX + iconWidth + spaceBetweenIcons;
    // doc.image("images/twitter-logo.png", secondIconX, doc.y, {
    //   width: iconWidth,
    // });

    // // Calculate X position for the third icon and place it
    // const thirdIconX = secondIconX + iconWidth + spaceBetweenIcons;
    // doc.image("images/ig-logo.jpeg", thirdIconX, doc.y, { width: iconWidth });

    // // Move down after placing the icons to avoid overlapping with other elements
    // doc.moveDown(0.5);

    // QR Code - You would need to generate a QR code image
    const qrCodeImageY = doc.y; // Store the current Y position to place the QR code
    const qrCodeSize = 50; // Set the QR code size

    doc.image(
      "images/exported_qrcode_image_600.png",
      doc.page.width / 2 - qrCodeSize / 2, // Center the QR code
      qrCodeImageY, // Y position stored earlier
      {
        width: qrCodeSize, // Use the size variable here
      }
    );

    // Calculate where the text should start, directly below the QR code
    const textY = qrCodeImageY + qrCodeSize + 10; // Add a little padding below the QR code

    // Center the text based on the entire page width
    // Make sure the 'width' property is large enough to fit the entire sentence
    doc.text(
      "Scan to visit our website",
      0, // Start text at the beginning of the writable area
      textY,
      {
        width: doc.page.width, // Use the full width of the page to center the text
        align: "center",
      }
    );

    // Finalize PDF file
    doc.end();
    await new Promise((resolve) => stream.on("finish", resolve));

    // Read the PDF into a buffer
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Read the logo image and convert it to a Base64 string
    const logoPath = path.join(__dirname, "images", "logoo.png");
    const logo = fs.readFileSync(logoPath).toString("base64");

    //   // Add social media links and QR code link to the HTML part of the email
    //   const htmlContent = `
    //   <!DOCTYPE html>
    //   <html lang="en">
    //   <head>
    //     <!-- Existing head content -->
    //   </head>
    //   <body>
    //     <!-- Existing body content -->
    //     <p>If you have any questions, please contact us at: <a href="mailto:support@example.com">support@example.com</a> or <a href="tel:+1234567890">(123) 456-7890</a>.</p>
    //     <p>Follow us on <a href="your-facebook-link">Facebook</a>, <a href="your-twitter-link">Twitter</a>, and <a href="your-instagram-link">Instagram</a>.</p>
    //     <!-- Rest of the HTML content -->
    //   </body>
    //   </html>
    // `;

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
        {
          content: logo,
          filename: "logoo.png",
          type: "image/png",
          disposition: "inline",
          content_id: "logoContentId",
        },
      ],
      // html: htmlContent,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Donation Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .header { background-color: #f8914e; padding: 10px; text-align: center; color: white; }
          .header img { height: 50px; }
          .content { margin: 20px; background-color: white; padding: 20px; border-bottom: 2px solid #eeeeee; }
          .highlight { color: #551aeb; font-weight: bold; font-size: 1.2em; }
          .footer { background-color: #f4f4f4; padding: 20px; text-align: center; }
          .button {
            background-color: #22b573;
            color: white;
            padding: 15px 25px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 18px;
            margin: 10px auto;
            cursor: pointer;
            border-radius: 5px;
            border: none;
            transition: background-color 0.3s ease;
          }
          .button:hover {
            background-color: #198c5b;
          }
          .testimonial { background-color: #e6e6e6; padding: 15px; margin-top: 20px; font-style: italic; }
          .signature { font-family: 'Brush Script MT', cursive; font-size: 1.5em; }
          .attachment-notice { font-size: 0.9em; color: #555; margin-top: 10px; }
          .donation-details {
            background-color: #f7f7f7;
            padding: 15px;
            margin-top: 15px;
            font-size: 14px;
            line-height: 1.6;
            font-family: Arial, sans-serif;
            border: 1px solid #dddddd;
            border-radius: 5px;
          }
          .donation-details td {
            padding: 8px 10px;
          }
          .donation-details td:first-child {
            font-weight: bold;
            color: #333333;
            white-space: nowrap;
          }
          @media screen and (max-width: 600px) {
            .header, .content, .footer {
              padding: 10px;
            }
            .button {
              width: 100%;
              padding: 15px 0;
            }
            .header img { height: auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="cid:logoContentId" alt="Change 4 Change Logo">
        </div>
        <div class="content">
          <p><strong>Hello <span class="highlight">${donorName},</span></strong></p>
          <p>Thank you for your <span class="highlight">${frequencyMessage} donation</span> of <span class="highlight">$${amount}</span> with fees included to <span class="highlight">${charityName}</span>.</p>
          <p>Your support is making a difference in the lives of many. We are truly grateful for your contribution and your commitment to our cause.</p>
          <div class="donation-details">
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <tr>
                <td style="padding: 8px 10px; font-weight: bold; white-space: nowrap; width: 50%;">Charged Amount:</td>
                <td style="padding: 8px 0; width: 50%;">$${amount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: bold; white-space: nowrap;">Donation Date:</td>
                <td style="padding: 8px 0;">${new Date().toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; font-weight: bold; white-space: nowrap;">Donation Number:</td>
                <td style="padding: 8px 0;">${Math.floor(
                  Math.random() * 100000000
                )}</td>
              </tr>
            </table>
          </div>
          <p class="attachment-notice">A detailed receipt of your donation is attached to this email. Please keep it for your records.</p>
        </div>
        <div class="footer">
          <p>If you have any questions, please don't hesitate to <a href="https://change-4-change-frontend.onrender.com/connect-us">contact us</a>.</p>
          <p>Follow us on <a href="#">Social Media</a></p>
          <p><a href="your-privacy-policy-link">Privacy Policy</a> | <a href="your-unsubscribe-link">Unsubscribe</a></p>
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
