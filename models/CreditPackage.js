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
    
    const packageObj = new CreditPackage(packageData);
    const result = await collection.insertOne(packageObj);
    return { ...packageObj, _id: result.insertedId };
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
    
    // Delete existing default packages to allow re-seeding with updates
    await collection.deleteMany({ 
      package_id: { 
        $in: [
          'article_starter', 'article_pro', 'article_business',
          'image_starter', 'image_pro',
          'rewrite_starter', 'rewrite_pro'
        ] 
      } 
    });

    const defaultPackages = [
      // Article packages
      {
      package_id: 'article_starter',
      name: '記事スターターパック',
      credit_type: 'article',
      credits: 10,
      price: 750,
      currency: 'JPY',
      description: '小さなブログに最適'
      },
      {
      package_id: 'article_pro',
      name: '記事プロパック',
      credit_type: 'article',
      credits: 50,
      price: 3000,
      currency: 'JPY',
      description: 'コンテンツクリエイター向け',
      is_popular: true
      },
      {
      package_id: 'article_business',
      name: '記事ビジネスパック',
      credit_type: 'article',
      credits: 100,
      price: 5500,
      currency: 'JPY',
      description: '大規模ウェブサイト向け'
      },
      
      // Image packages
      {
      package_id: 'image_starter',
      name: '画像スターターパック',
      credit_type: 'image',
      credits: 20,
      price: 300,
      currency: 'JPY',
      description: 'ビジュアルコンテンツに最適'
      },
      {
      package_id: 'image_pro',
      name: '画像プロパック',
      credit_type: 'image',
      credits: 100,
      price: 1200,
      currency: 'JPY',
      description: 'ビジュアルストーリーテラー向け',
      is_popular: true
      },
      
      // Rewrite packages
      {
      package_id: 'rewrite_starter',
      name: 'リライトスターターパック',
      credit_type: 'rewrite',
      credits: 50,
      price: 3000,
      currency: 'JPY',
      description: '既存コンテンツを最適化',
      discount: '17% off'
      },
      {
      package_id: 'rewrite_pro',
      name: 'リライトプロパック',
      credit_type: 'rewrite',
      credits: 150,
      price: 8000,
      currency: 'JPY',
      description: 'コンテンツ最適化向け'
      }
    ];


    for (const packageData of defaultPackages) {
      await this.create(packageData);
    }
  }
}

module.exports = CreditPackage;