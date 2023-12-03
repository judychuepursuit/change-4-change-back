// const bcrypt = require('bcrypt');
const db = require('../db/dbConfig');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid email' });
    }

    // Compare the provided password with the hashed password from the database
    // const passwordMatch = await bcrypt.compare(password, user.password);

    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    return res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  login,
};
