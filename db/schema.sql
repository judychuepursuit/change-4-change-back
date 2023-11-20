DROP DATABASE IF EXISTS charities_dev;
CREATE DATABASE charities_dev;

\c charities_dev;


CREATE TABLE charities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  stripe_account_id VARCHAR(255) NOT NULL
);


