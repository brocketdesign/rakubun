const express = require('express');
const router = express.Router();
const axios = require('axios');
const { ObjectId } = require('mongodb');

// Route to check the plugin activation status from WordPress
router.get('/check-plugin-status', async (req, res) => {
    // Retrieve the WordPress site URL from query parameters
    const { wordpressUrl } = req.query;  // Example: /check-plugin-status?wordpressUrl=http://example.com
    if (!wordpressUrl) {
        return res.status(400).json({ message: 'WordPress site URL is required as a query parameter.' });
    }

    const apiKey = 'MIICXAIBAAKBgQCqGSM44QXyqES1b45TqJiWaqR5WQj86fTpTnmvXopbEwq7XQ6h'; // The API Key, securely handled

    try {
        const response = await axios.get(`${wordpressUrl}/wp-json/custompopup/v1/status/`, {
            params: {
                api_key: apiKey
            }
        });

        res.status(200).json({
            message: 'Successfully fetched plugin status',
            status: response.data.status  // Assuming the response from WP is { status: 'active' }
        });
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: 'Error fetching plugin status from the provided URL',
            //error: error.message
        });
    }
});

app.get('/affiliate-data', async (req, res) => {
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

app.post('/affiliate-data', async (req, res) => {
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

app.post('/receive-affiliate-data', async (req, res) => {
    try {
        const userData = req.body; // Data sent from the form
        if (!userData) {
            return res.status(400).send({ message: 'No user data provided' });
        }

        // Optional: Validate userData here before inserting into the database

        const result = await global.db.collection('affiliate').insertOne(userData);
        res.status(201).send({ message: 'User data added successfully', userId: result.insertedId });
    } catch (error) {
        res.status(500).send({ message: 'Error receiving user data', error: error.message });
    }
});

module.exports = router;
