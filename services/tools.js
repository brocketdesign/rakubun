const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { premiumPlan } = require('../modules/products');

/**
 * Add a user to the freePlan on Stripe.
**/
async function addUsertoFreePlan(userEmail) {
  console.log(`Adding user with Email: ${userEmail} to Stripe freePlan...`);

  // Create a new customer in Stripe
  const customer = await stripe.customers.create({
    email: userEmail,
    description: `${userEmail}`
  });

  console.log(`User with Email: ${userEmail} successfully created in Stripe as customer ID: ${customer.id}.`);

  // Since we're not creating a PaymentIntent, just return the Stripe customer ID
  return {
    stripeCustomerId: customer.id
  };
}

function formatDateToDDMMYYHHMMSS() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).substr(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ddmmyyhhmmss = `${day}${month}${year}${hours}${minutes}${seconds}`;
  return ddmmyyhhmmss;
}

module.exports = {
  addUsertoFreePlan,
  formatDateToDDMMYYHHMMSS
};
