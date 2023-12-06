\c charities_dev;
INSERT INTO charities (name, stripe_account_id) VALUES
('ASPCA', 'acct_1OEpakQTN4c4HEpl'), 
('Feeding America', 'acct_1OCtfWQPst9pmMFX'), 
('Red Cross', 'acct_1OCtgDQRnTyfQud7'),
('UNICEF', 'acct_1OCtjmQS1DLaPBq0'); 

INSERT INTO transactions (charity_id, amount, currency, donation_frequency, stripe_payment_intent_id, created_at) VALUES
(1, 50, 'USD', 'one-time', 'pi_3OJp5qKw0bozpjFO0CIio5LR', '2023-01-01T00:00:00Z'),
