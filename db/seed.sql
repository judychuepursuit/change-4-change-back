-- \c users_dev;


\c charities_dev;

--login
INSERT INTO users (first_name, last_name, birth_date, email, password) VALUES ('alli', 'sali', '02/26/1997', 'user@example.com', 'password123');

--register
INSERT INTO users (first_name, last_name, birth_date, email, password) VALUES ('John', 'Doe', '02/26/1997', 'newuser@example.com', 'newpassword456');

INSERT INTO charities (name, stripe_account_id) VALUES
('ASPCA', 'acct_1OEpakQTN4c4HEpl'), 
('Feeding America', 'acct_1OCtfWQPst9pmMFX'), 
('Red Cross', 'acct_1OCtgDQRnTyfQud7'),
('UNICEF', 'acct_1OCtjmQS1DLaPBq0'); 


INSERT INTO transactions (charity_id, amount, currency, donation_frequency, stripe_payment_intent_id, created_at) VALUES
(1, 50, 'USD', 'one-time', 'pi_3OJp5qKw0bozpjFO0CIio5LR', '2023-01-01T00:00:00Z');

