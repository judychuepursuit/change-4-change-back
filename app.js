// // DEPENDENCIES
// const cors = require("cors");
// const express = require("express");

// // CONFIGURATION
// const app = express();

// // MIDDLEWARE
// app.use(cors());
// app.use(express.json());

// // ROUTES
// app.get("/", (req, res) => {
//   res.send("Welcome to the City App");
// });

// // Cities ROUTES
// const cityController = require("./controllers/cityController.js");
// app.use("/cities", cityController);

// // 404 PAGE
// app.get("*", (req, res) => {
//   res.status(404).send("Page not found");
// });

// // EXPORT
// module.exports = app;
// DEPENDENCIES
const cors = require("cors");
const express = require("express");


// CONFIGURATION
const app = express();


// MIDDLEWARE
app.use(cors());
app.use(express.json());


const loginController = require('./controllers/loginController');
const registerController = require('./controllers/registerController');




// ROUTES
app.get("/", (req, res) => {
  res.send("Hello");
});

// Users ROUTE
app.get("/users", async (req, res) => {
  try {
    
    const users = await db.any('SELECT * FROM users');

    res.json(users);
  } catch (error) {
    console.error("Error in /users route:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Login ROUTE
app.post("/login", loginController.login);

// Registration ROUTE
app.post("/register", registerController.register);

// 404 PAGE
app.get("*", (req, res) => {
  res.status(404).send("Page not found");
});

// EXPORT
module.exports = app;
