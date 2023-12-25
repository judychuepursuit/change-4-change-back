// Load environment variables first
require("dotenv").config();

// Then, require your application logic
const app = require("./app");

// Finally, start your server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
