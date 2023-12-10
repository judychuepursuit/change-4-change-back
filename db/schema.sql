DROP DATABASE IF EXISTS charities_dev;
CREATE DATABASE charities_dev;

\c charities_dev;

DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  birth_date DATE NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);


DROP TABLE IF EXISTS charities;

CREATE TABLE charities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  stripe_account_id VARCHAR(255) NOT NULL
);


DROP TABLE IF EXISTS transactions;

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  charity_id INTEGER REFERENCES charities(id),
  amount DECIMAL NOT NULL,
  currency VARCHAR(3) NOT NULL,
  donation_frequency VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


