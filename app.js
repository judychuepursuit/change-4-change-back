const cors = require("cors");
const express = require("express");
const pool = require("./db/dbConfig");

const app = express();

app.use(cors());
app.use(express.json());


const loginController = require("./controllers/loginController");
const registerController = require("./controllers/registerController");
// const loginController = require('./controllers/loginController');
// const registerController = require('./controllers/registerController');

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

app.get("*", (req, res) => {
  res.status(404).send("Page not found");
});

module.exports = app;
