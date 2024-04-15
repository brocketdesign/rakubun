const express = require('express');
const router = express.Router();
const axios = require('axios');
const { ObjectId } = require('mongodb');
const url = require('url');

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
// Endpoint to check popup authorization
router.get('/check-popup-authorization', async (req, res) => {
    try {
        // Extract the domain query parameter
        const { domain } = req.query;

        if (!domain) {
            return res.status(400).json({ error: 'Domain parameter is required' });
        }

        // Assuming 'affiliate' collection has documents with a 'domain' and 'isActive' fields
        const affiliate = await global.db.collection('affiliate').findOne({ domain });

        if (!affiliate) {
            return res.status(404).json({ error: 'Affiliate not found' });
        }

        // Check if the affiliate is active
        if (affiliate.isActive) {
            res.json({ authorized: true });
        } else {
            res.json({ authorized: false });
        }
    } catch (error) {
        console.error('Failed to check popup authorization:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Route to get all affiliate data
router.get('/all-affiliate-data', async (req, res) => {
    try {
        const affiliates = await global.db.collection('affiliate').find({}).toArray();
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
        const affiliateId = new ObjectId(req.body.affiliateId); // The ID of the user to update
        const updates = req.body.updates; // The data to update

        if (!affiliateId || !updates) {
            return res.status(400).send({ message: 'affiliateId and updates data are required' });
        }
        const result = await global.db.collection('affiliate').updateOne({ _id: affiliateId }, { $set: updates });
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
        const userData = req.body; // Data sent from the form

        if (Object.keys(userData).length === 0) {
            return res.status(400).send({ message: 'No user data provided' });
        }

        // Extract the domain from the wordpressUrl
        if (userData.wordpressUrl) {
            const parsedUrl = new URL(userData.wordpressUrl);
            userData.domain = parsedUrl.hostname; // Extracts domain name
        } else {
            return res.status(400).send({ message: 'wordpressUrl is required' });
        }

        // Prepare the update options
        const filter = { domain: userData.domain };
        const update = { $set: userData };
        const options = { upsert: true }; // Create a new document if one doesn't exist

        const result = await global.db.collection('affiliate').updateOne(filter, update, options);

        // Determine the appropriate response based on the operation performed
        if (result.upsertedCount > 0) {
            res.status(201).send({
                message: 'New user data added successfully',
                userId: result.upsertedId._id,
                domain: userData.domain
            });
        } else if (result.modifiedCount > 0) {
            res.status(200).send({
                message: 'User data updated successfully',
                domain: userData.domain
            });
        } else {
            res.status(200).send({
                message: 'No changes made to user data',
                domain: userData.domain
            });
        }
    } catch (error) {
        res.status(500).send({
            message: 'Error receiving user data',
            error: error.message
        });
    }
});

router.delete('/delete-affiliate/:id', async (req, res) => {
    const affiliateId = req.params.id;

    try {
        const result = await global.db.collection('affiliate').deleteOne({ _id: new ObjectId(affiliateId) });
        if (result.deletedCount === 1) {
            res.status(200).send({ message: 'Affiliate deleted successfully' });
        } else {
            res.status(404).send({ message: 'Affiliate not found' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Failed to delete affiliate', error: error.message });
    }
});
module.exports = router;
