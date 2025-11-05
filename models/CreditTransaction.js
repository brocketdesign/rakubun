const { ObjectId } = require('mongodb');

class CreditTransaction {
  constructor(transactionData) {
    this.site_id = transactionData.site_id;
    this.user_id = transactionData.user_id;
    this.transaction_type = transactionData.transaction_type; // 'purchase', 'deduction', 'refund', 'bonus'
    this.credit_type = transactionData.credit_type; // 'article', 'image', 'rewrite'
    this.amount = transactionData.amount;
    this.balance_after = transactionData.balance_after;
    this.reference_id = transactionData.reference_id;
    this.description = transactionData.description;
    this.created_at = transactionData.created_at || new Date();
  }

  static async create(transactionData) {
    const db = global.db;
    const collection = db.collection('credit_transactions');
    
    const transaction = new CreditTransaction(transactionData);
    const result = await collection.insertOne(transaction);
    return { ...transaction, _id: result.insertedId };
  }

  static async findByUserId(siteId, userId, limit = 50) {
    const db = global.db;
    const collection = db.collection('credit_transactions');
    return await collection.find({ 
      site_id: new ObjectId(siteId), 
      user_id: userId 
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  }

  static async findBySiteId(siteId, limit = 100) {
    const db = global.db;
    const collection = db.collection('credit_transactions');
    return await collection.find({ site_id: new ObjectId(siteId) })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  }

  static async logPurchase(siteId, userId, creditType, amount, balanceAfter, referenceId = null) {
    return await this.create({
      site_id: siteId,
      user_id: userId,
      transaction_type: 'purchase',
      credit_type: creditType,
      amount: amount,
      balance_after: balanceAfter,
      reference_id: referenceId,
      description: `Purchased ${amount} ${creditType} credits`
    });
  }

  static async logDeduction(siteId, userId, creditType, amount, balanceAfter, description = null) {
    return await this.create({
      site_id: siteId,
      user_id: userId,
      transaction_type: 'deduction',
      credit_type: creditType,
      amount: -amount, // Negative for deductions
      balance_after: balanceAfter,
      description: description || `Used ${amount} ${creditType} credit(s)`
    });
  }

  static async logBonus(siteId, userId, creditType, amount, balanceAfter, description = null) {
    return await this.create({
      site_id: siteId,
      user_id: userId,
      transaction_type: 'bonus',
      credit_type: creditType,
      amount: amount,
      balance_after: balanceAfter,
      description: description || `Bonus ${amount} ${creditType} credits`
    });
  }

  static async logRefund(siteId, userId, creditType, amount, balanceAfter, referenceId = null) {
    return await this.create({
      site_id: siteId,
      user_id: userId,
      transaction_type: 'refund',
      credit_type: creditType,
      amount: amount,
      balance_after: balanceAfter,
      reference_id: referenceId,
      description: `Refund ${amount} ${creditType} credits`
    });
  }

  static async getTransactionStats(siteId, dateFrom = null, dateTo = null) {
    const db = global.db;
    const collection = db.collection('credit_transactions');
    
    const matchQuery = { site_id: new ObjectId(siteId) };
    
    if (dateFrom || dateTo) {
      matchQuery.created_at = {};
      if (dateFrom) matchQuery.created_at.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.created_at.$lte = new Date(dateTo);
    }

    const stats = await collection.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            transaction_type: '$transaction_type',
            credit_type: '$credit_type'
          },
          total_amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.credit_type',
          transactions: {
            $push: {
              type: '$_id.transaction_type',
              amount: '$total_amount',
              count: '$count'
            }
          }
        }
      }
    ]).toArray();

    return stats;
  }

  static async getRecentTransactions(limit = 20) {
    const db = global.db;
    const collection = db.collection('credit_transactions');
    
    return await collection.aggregate([
      {
        $lookup: {
          from: 'external_sites',
          localField: 'site_id',
          foreignField: '_id',
          as: 'site'
        }
      },
      {
        $unwind: '$site'
      },
      {
        $lookup: {
          from: 'external_users',
          let: { siteId: '$site_id', userId: '$user_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$site_id', '$$siteId'] },
                    { $eq: ['$user_id', '$$userId'] }
                  ]
                }
              }
            }
          ],
          as: 'user'
        }
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $limit: limit
      }
    ]).toArray();
  }
}

module.exports = CreditTransaction;