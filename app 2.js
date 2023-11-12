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
