const express = require('express');
const router = express.Router();
const axios = require('axios');
const { ObjectId } = require('mongodb');

// Route to check the plugin activation status from WordPress
router.get('/check-plugin-status', async (req, res) => {
    const { affiliateId } = req.query; // Get affiliateId from query parameters

    if (!affiliateId) {
        return res.status(400).json({ message: 'Affiliate ID is required as a query parameter.' });
    }

    try {
        // Find the affiliate in the database using ObjectId
        const affiliate = await global.db.collection('affiliate').findOne({ _id: new ObjectId(affiliateId) });

        if (!affiliate || !affiliate.wordpressUrl) {
            return res.status(404).json({ message: 'Affiliate not found or WordPress URL missing' });
        }

        const wordpressUrl = affiliate.wordpressUrl;
        const apiKey = 'MIICXAIBAAKBgQCqGSM44QXyqES1b45TqJiWaqR5WQj86fTpTnmvXopbEwq7XQ6h'; // The API Key, securely handled

        // Make the API request to the WordPress URL
        const response = await axios.get(`${wordpressUrl}/wp-json/custompopup/v1/status/`, {
            params: { api_key: apiKey }
        });

        res.status(200).json({
            message: 'Successfully fetched plugin status',
            status: response.data.status  // Assuming the response from WP is { status: 'active' }
        });
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: 'Error fetching plugin status from the provided URL',
            error: error.message
        });
    }
});
// Route to get all affiliate data
router.get('/all-affiliate-data', async (req, res) => {
    try {
        const affiliates = await global.db.collection('affiliate').find({}).toArray();
        console.log(affiliates)
        res.status(200).json(affiliates);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching affiliate data', error: error.message });
    }
});
router.get('/affiliate-data', async (req, res) => {
    try {
        const userId = new ObjectId(req.query.userId); // Assuming you pass the userId as a query parameter
        if (!userId) {
            return res.status(400).send({ message: 'UserId parameter is required' });
        }

        const userData = await global.db.collection('affiliate').findOne({ _id: userId });
        if (userData) {
            res.status(200).send(userData);
        } else {
            res.status(404).send({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving user data', error: error.message });
    }
});

router.post('/affiliate-data', async (req, res) => {
    try {
        const userId = new ObjectId(req.body.userId); // The ID of the user to update
        const updates = req.body.updates; // The data to update

        if (!userId || !updates) {
            return res.status(400).send({ message: 'UserId and updates data are required' });
        }

        const result = await global.db.collection('affiliate').updateOne({ _id: userId }, { $set: updates });
        if (result.modifiedCount === 0) {
            return res.status(404).send({ message: 'User not found or no updates made' });
        }

        res.status(200).send({ message: 'User data updated successfully' });
    } catch (error) {
        res.status(500).send({ message: 'Error updating user data', error: error.message });
    }
});

router.post('/receive-affiliate-data', async (req, res) => {
    try {
        console.log(req.body);  // Log the body to see what is received
        console.log(req.headers);  // Log headers to check the Content-Type

        const userData = req.body; // Data sent from the form
        if (Object.keys(userData).length === 0) {
            return res.status(400).send({ message: 'No user data provided' });
        }

        // Optional: Validate userData here before inserting into the database
        console.log(userData)

        const result = await global.db.collection('affiliate').insertOne(userData);
        res.status(201).send({ message: 'User data added successfully', userId: result.insertedId });
    } catch (error) {
        res.status(500).send({ message: 'Error receiving user data', error: error.message });
    }
});

module.exports = router;
