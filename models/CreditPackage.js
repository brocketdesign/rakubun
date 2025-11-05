const { ObjectId } = require('mongodb');

class CreditPackage {
  constructor(packageData) {
    this.package_id = packageData.package_id;
    this.name = packageData.name;
    this.credit_type = packageData.credit_type; // 'article', 'image', 'rewrite'
    this.credits = packageData.credits;
    this.price = packageData.price;
    this.currency = packageData.currency || 'JPY';
    this.description = packageData.description;
    this.is_popular = packageData.is_popular || false;
    this.is_active = packageData.is_active !== undefined ? packageData.is_active : true;
    this.discount = packageData.discount;
    this.created_at = packageData.created_at || new Date();
    this.updated_at = packageData.updated_at || new Date();
  }

  static async create(packageData) {
    const db = global.db;
    const collection = db.collection('credit_packages');
    
    const package = new CreditPackage(packageData);
    const result = await collection.insertOne(package);
    return { ...package, _id: result.insertedId };
  }

  static async findAll() {
    const db = global.db;
    const collection = db.collection('credit_packages');
    return await collection.find({ is_active: true }).sort({ credit_type: 1, price: 1 }).toArray();
  }

  static async findByType(creditType) {
    const db = global.db;
    const collection = db.collection('credit_packages');
    return await collection.find({ 
      credit_type: creditType, 
      is_active: true 
    }).sort({ price: 1 }).toArray();
  }

  static async findById(id) {
    const db = global.db;
    const collection = db.collection('credit_packages');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findByPackageId(packageId) {
    const db = global.db;
    const collection = db.collection('credit_packages');
    return await collection.findOne({ package_id: packageId, is_active: true });
  }

  static async updateById(id, updateData) {
    const db = global.db;
    const collection = db.collection('credit_packages');
    updateData.updated_at = new Date();
    return await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
  }

  static async deleteById(id) {
    const db = global.db;
    const collection = db.collection('credit_packages');
    return await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { is_active: false, updated_at: new Date() } }
    );
  }

  static async getPackagesGrouped() {
    const db = global.db;
    const collection = db.collection('credit_packages');
    
    const packages = await collection.find({ is_active: true }).toArray();
    
    const grouped = {
      articles: packages.filter(p => p.credit_type === 'article'),
      images: packages.filter(p => p.credit_type === 'image'),
      rewrites: packages.filter(p => p.credit_type === 'rewrite')
    };
    
    return grouped;
  }

  static async seedDefaultPackages() {
    const db = global.db;
    const collection = db.collection('credit_packages');
    
    // Check if packages already exist
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      return; // Packages already seeded
    }

    const defaultPackages = [
      // Article packages
      {
        package_id: 'article_starter',
        name: 'Article Starter Pack',
        credit_type: 'article',
        credits: 10,
        price: 750,
        currency: 'JPY',
        description: 'Perfect for small blogs'
      },
      {
        package_id: 'article_pro',
        name: 'Article Pro Pack',
        credit_type: 'article',
        credits: 50,
        price: 3000,
        currency: 'JPY',
        description: 'For content creators',
        is_popular: true
      },
      {
        package_id: 'article_business',
        name: 'Article Business Pack',
        credit_type: 'article',
        credits: 100,
        price: 5500,
        currency: 'JPY',
        description: 'For large websites'
      },
      
      // Image packages
      {
        package_id: 'image_starter',
        name: 'Image Starter Pack',
        credit_type: 'image',
        credits: 20,
        price: 300,
        currency: 'JPY',
        description: 'Great for visual content'
      },
      {
        package_id: 'image_pro',
        name: 'Image Pro Pack',
        credit_type: 'image',
        credits: 100,
        price: 1200,
        currency: 'JPY',
        description: 'For visual storytellers',
        is_popular: true
      },
      
      // Rewrite packages
      {
        package_id: 'rewrite_starter',
        name: 'Rewrite Starter Pack',
        credit_type: 'rewrite',
        credits: 50,
        price: 3000,
        currency: 'JPY',
        description: 'Optimize existing content',
        discount: '17% off'
      },
      {
        package_id: 'rewrite_pro',
        name: 'Rewrite Pro Pack',
        credit_type: 'rewrite',
        credits: 150,
        price: 8000,
        currency: 'JPY',
        description: 'For content optimization'
      }
    ];

    for (const packageData of defaultPackages) {
      await this.create(packageData);
    }
  }
}

module.exports = CreditPackage;