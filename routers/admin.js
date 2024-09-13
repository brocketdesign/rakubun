// Section generator
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

const adminEmails = ['japanclassicstore@gmail.com']; // Replace with actual admin emails

router.get('/users', async function (req, res, next) {
  try {
    const userEmail = req.user.email;

    if (!adminEmails.includes(userEmail)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = db.collection('users');
    const userList = await users.find({ email: { $exists: true } }).toArray();

    res.render('dashboard/admin/users', {
      title: 'User List',
      users: userList,
      user:req.user,
    });
  } catch (err) {
    next(err);
  }
});
router.delete('/users/:userId', async function (req, res, next) {
  try {
    const userEmail = req.user.email;

    if (!adminEmails.includes(userEmail)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userId = req.params.userId;
    const users = db.collection('users');

    const result = await users.deleteOne({ _id: new ObjectId(userId) });

    if (result.deletedCount === 1) {
      res.status(200).json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    next(err);
  }
});


module.exports = router