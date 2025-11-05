const { ObjectId } = require('mongodb');

class GenerationLog {
  constructor(logData) {
    this.site_id = logData.site_id;
    this.user_id = logData.user_id;
    this.content_type = logData.content_type; // 'article', 'image', 'rewrite'
    this.prompt = logData.prompt;
    this.result_length = logData.result_length;
    this.credits_used = logData.credits_used || 1;
    this.processing_time = logData.processing_time;
    this.status = logData.status || 'success'; // 'success', 'failed', 'error'
    this.error_message = logData.error_message;
    this.created_at = logData.created_at || new Date();
  }

  static async create(logData) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    
    const log = new GenerationLog(logData);
    const result = await collection.insertOne(log);
    return { ...log, _id: result.insertedId };
  }

  static async logGeneration(siteId, userId, contentType, prompt, resultLength, creditsUsed = 1, processingTime = null) {
    return await this.create({
      site_id: siteId,
      user_id: userId,
      content_type: contentType,
      prompt: prompt,
      result_length: resultLength,
      credits_used: creditsUsed,
      processing_time: processingTime,
      status: 'success'
    });
  }

  static async logError(siteId, userId, contentType, prompt, errorMessage, processingTime = null) {
    return await this.create({
      site_id: siteId,
      user_id: userId,
      content_type: contentType,
      prompt: prompt,
      result_length: 0,
      credits_used: 0,
      processing_time: processingTime,
      status: 'error',
      error_message: errorMessage
    });
  }

  static async findBySiteId(siteId, limit = 100) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    return await collection.find({ site_id: new ObjectId(siteId) })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  }

  static async findByUserId(siteId, userId, limit = 50) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    return await collection.find({ 
      site_id: new ObjectId(siteId), 
      user_id: userId 
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  }

  static async getGenerationStats(siteId, dateFrom = null, dateTo = null) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    
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
            content_type: '$content_type',
            status: '$status'
          },
          count: { $sum: 1 },
          total_credits: { $sum: '$credits_used' },
          avg_processing_time: { $avg: '$processing_time' },
          total_length: { $sum: '$result_length' }
        }
      },
      {
        $group: {
          _id: '$_id.content_type',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count',
              total_credits: '$total_credits',
              avg_processing_time: '$avg_processing_time',
              total_length: '$total_length'
            }
          }
        }
      }
    ]).toArray();

    return stats;
  }

  static async getDailyGenerations(siteId, days = 30) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    return await collection.aggregate([
      {
        $match: {
          site_id: new ObjectId(siteId),
          created_at: { $gte: fromDate },
          status: 'success'
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$created_at'
              }
            },
            content_type: '$content_type'
          },
          count: { $sum: 1 },
          credits_used: { $sum: '$credits_used' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          generations: {
            $push: {
              content_type: '$_id.content_type',
              count: '$count',
              credits_used: '$credits_used'
            }
          },
          total_count: { $sum: '$count' },
          total_credits: { $sum: '$credits_used' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();
  }

  static async getRecentGenerations(limit = 20) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    
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

  static async getTopUsers(siteId, limit = 10) {
    const db = global.db;
    const collection = db.collection('generation_logs');
    
    return await collection.aggregate([
      {
        $match: {
          site_id: new ObjectId(siteId),
          status: 'success'
        }
      },
      {
        $group: {
          _id: '$user_id',
          total_generations: { $sum: 1 },
          total_credits_used: { $sum: '$credits_used' },
          last_generation: { $max: '$created_at' }
        }
      },
      {
        $lookup: {
          from: 'external_users',
          let: { siteId: new ObjectId(siteId), userId: '$_id' },
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
        $sort: { total_generations: -1 }
      },
      {
        $limit: limit
      }
    ]).toArray();
  }
}

module.exports = GenerationLog;