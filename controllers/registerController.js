const pool = require('../db/dbConfig');

const register = async (req, res) => {
  const { first_name, last_name, birth_date, email, password } = req.body;

  if (!email || !password || !first_name || !last_name || !birth_date) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log("Hello !")

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    console.log("user exists")
    const createdUser = await pool.query(
      'INSERT INTO users (first_name, last_name, birth_date, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [first_name, last_name, birth_date, email, password]
    );
    console.log("should have created user")
    

    if (createdUser.rows.length > 0) {
      return res.status(201).json({ message: 'Registration successful' });
    }
    console.log("registered")

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
};
