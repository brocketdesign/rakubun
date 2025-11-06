const { ObjectId } = require('mongodb');

class ExternalUser {
  constructor(userData) {
    this.site_id = userData.site_id;
    this.user_id = userData.user_id;
    this.user_email = userData.user_email;
    this.article_credits = userData.article_credits || 0;
    this.image_credits = userData.image_credits || 0;
    this.rewrite_credits = userData.rewrite_credits || 0;
    this.total_articles_generated = userData.total_articles_generated || 0;
    this.total_images_generated = userData.total_images_generated || 0;
    this.total_rewrites_generated = userData.total_rewrites_generated || 0;
    this.created_at = userData.created_at || new Date();
    this.updated_at = userData.updated_at || new Date();
  }

  static async create(userData) {
    const db = global.db;
    const collection = db.collection('external_users');
    
    const user = new ExternalUser(userData);
    const result = await collection.insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  static async findBySiteAndUserId(siteId, userId) {
    const db = global.db;
    const collection = db.collection('external_users');
    return await collection.findOne({ 
      site_id: new ObjectId(siteId), 
      user_id: userId 
    });
  }

  static async findBySiteAndEmail(siteId, userEmail) {
    const db = global.db;
    const collection = db.collection('external_users');
    return await collection.findOne({ 
      site_id: new ObjectId(siteId), 
      user_email: userEmail 
    });
  }

  static async findBySiteId(siteId) {
    const db = global.db;
    const collection = db.collection('external_users');
    return await collection.find({ site_id: new ObjectId(siteId) }).toArray();
  }

  static async updateCredits(siteId, userId, creditType, amount) {
    const db = global.db;
    const collection = db.collection('external_users');
    
    const incField = {};
    incField[`${creditType}_credits`] = amount;
    
    return await collection.updateOne(
      { site_id: new ObjectId(siteId), user_id: userId },
      { 
        $inc: incField,
        $set: { updated_at: new Date() }
      }
    );
  }

  static async deductCredits(siteId, userId, creditType, amount = 1) {
    const db = global.db;
    const collection = db.collection('external_users');
    
    const user = await this.findBySiteAndUserId(siteId, userId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentCredits = user[`${creditType}_credits`] || 0;
    if (currentCredits < amount) {
      throw new Error('Insufficient credits');
    }

    const updateFields = {
      updated_at: new Date()
    };
    updateFields[`${creditType}_credits`] = currentCredits - amount;
    updateFields[`total_${creditType}s_generated`] = (user[`total_${creditType}s_generated`] || 0) + 1;

    const result = await collection.updateOne(
      { site_id: new ObjectId(siteId), user_id: userId },
      { $set: updateFields }
    );

    // Return updated credits
    const updatedUser = await this.findBySiteAndUserId(siteId, userId);
    return {
      article_credits: updatedUser.article_credits,
      image_credits: updatedUser.image_credits,
      rewrite_credits: updatedUser.rewrite_credits
    };
  }

  static async getOrCreateUser(siteId, userId, userEmail) {
    let user = await this.findBySiteAndUserId(siteId, userId);
    if (!user) {
      user = await this.create({
        site_id: siteId,
        user_id: userId,
        user_email: userEmail,
        article_credits: 5, // Default free credits
        image_credits: 10,
        rewrite_credits: 3
      });
    }
    return user;
  }

  static async addCredits(siteId, userId, creditType, amount) {
    const db = global.db;
    const collection = db.collection('external_users');
    
    const updateField = {};
    updateField[`${creditType}_credits`] = amount;
    updateField.updated_at = new Date();
    
    return await collection.updateOne(
      { site_id: new ObjectId(siteId), user_id: userId },
      { $inc: updateField }
    );
  }

  static async getAllUsers() {
    const db = global.db;
    const collection = db.collection('external_users');
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
        $sort: { created_at: -1 }
      }
    ]).toArray();
  }
}

module.exports = ExternalUser;