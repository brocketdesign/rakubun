const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { ObjectId } = require('mongodb');
const { daysLeft } = require('../services/tools')

const ensureMembership = async (req, res, next) => {
    try {
        const updatedUser = ensureSignupDate(req.user);
        global.db.collection('users').updateOne({ _id: new ObjectId(updatedUser._id) }, { $set: { signup_date: updatedUser.signup_date } });
      
        // Calculate the number of days since the user signed up
        const daysRemaining = daysLeft(req.user);
        // Log the number of days left
        console.log(`Days left for user ${req.user._id}: ${daysRemaining}`);

        // If it's been more than 7 days and they don't have an active subscription
        if (daysRemaining <= 0 && !req.user.subscriptionId) {
            req.flash('error', 'メンバーシップが必要です。1週間無料'); // "You need a membership."
            return res.redirect('/payment/subscription');
        }

        // If the user has a subscriptionId, fetch the user's subscriptions from Stripe
        if (req.user.subscriptionId) {
            const subscriptions = await stripe.subscriptions.list({ customer: req.user.stripeCustomerID });

            // Check if the user has an active subscription
            const hasActiveSubscription = subscriptions.data.some(subscription => subscription.status === 'active');

            if (!hasActiveSubscription) {
                req.flash('error', 'アクティブなメンバーシップが必要です。'); // "You need an active membership."
                return res.redirect('/payment/subscription');
            }
        }

        // If the user has an active subscription or is still in the trial period, proceed to the next middleware
        next();
    } catch (error) {
        console.log('Failed to check user subscription status:', error);
        res.redirect('/error');
    }
}
function ensureSignupDate(user) {
  // Check if the user object has the signup_date field
  if (!user.hasOwnProperty('signup_date') || user.signup_date === null || user.signup_date === undefined) {
      // If not, initialize it with the current date
      user.signup_date = new Date();
  }
  return user;
}

module.exports = ensureMembership;
