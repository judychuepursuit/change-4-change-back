// const bcrypt = require('bcrypt');
const db = require('../db/dbConfig');

const register = async (req, res) => {
  const { firstName, lastName, birth_date, email, password } = req.body;

  if (!email || !password || !firstName || !lastName || !birth_date) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the email is already registered
    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE email = $1', email);

    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    // Hash the password before storing it
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const createdUser = await db.one(
      'INSERT INTO users (first_name, last_name, birth_date, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [firstName, lastName, birth_date, email, password]
    );

    if (createdUser) {
      return res.status(201).json({ message: 'Registration successful' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
};
