const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { ObjectId } = require('mongodb');

router.get('/register', (req, res) => {
  res.render('enterprise/register', { user: req.user });
});

router.post('/register', async (req, res) => {
  const { companyName, domain, email, password, plan } = req.body;
  try {
    const existingEnterprise = await global.db.collection('enterprises').findOne({ domain: domain });
    if (existingEnterprise) return res.status(400).send('Enterprise with this domain already exists.');
    const hashedPassword = await bcrypt.hash(password, 10);
    const stripeCustomer = await stripe.customers.create({ email: email, name: companyName });
    const priceId = getPriceIdForPlan(plan);
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: priceId }],
    });
    const newEnterprise = {
      companyName,
      domain,
      email,
      password: hashedPassword,
      plan,
      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: subscription.id,
      employees: [],
    };
    await global.db.collection('enterprises').insertOne(newEnterprise);
    res.redirect('/enterprise/register-success');
  } catch (error) {
    res.status(500).send('An error occurred during enterprise registration.');
  }
});

router.get('/register-success', (req, res) => {
  res.render('enterprise/register-success', { user: req.user });
});

function getPriceIdForPlan(plan) {
  if (plan === '5') return process.env.STRIPE_PRICE_ID_PLAN_5;
  else if (plan === '15') return process.env.STRIPE_PRICE_ID_PLAN_15;
  else if (plan === '30') return process.env.STRIPE_PRICE_ID_PLAN_30;
  else throw new Error('Invalid plan selected.');
}

module.exports = router;
