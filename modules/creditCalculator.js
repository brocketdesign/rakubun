class CreditCalculator {
  constructor() {
    // Default credit costs
    this.defaultCosts = {
      article: {
        short: 1,    // < 500 words
        medium: 1,   // 500-1500 words
        long: 2      // > 1500 words
      },
      image: {
        standard: 1,  // Standard image generation
        hd: 2        // HD image generation
      },
      rewrite: {
        short: 1,    // < 500 words
        medium: 1,   // 500-1500 words
        long: 2      // > 1500 words
      }
    };
  }

  /**
   * Calculate credits needed for article generation
   */
  calculateArticleCredits(wordCount, quality = 'standard') {
    if (wordCount < 500) {
      return this.defaultCosts.article.short;
    } else if (wordCount <= 1500) {
      return this.defaultCosts.article.medium;
    } else {
      return this.defaultCosts.article.long;
    }
  }

  /**
   * Calculate credits needed for image generation
   */
  calculateImageCredits(quality = 'standard', count = 1) {
    const creditPerImage = quality === 'hd' 
      ? this.defaultCosts.image.hd 
      : this.defaultCosts.image.standard;
    
    return creditPerImage * count;
  }

  /**
   * Calculate credits needed for rewrite
   */
  calculateRewriteCredits(originalWordCount, complexity = 'standard') {
    if (originalWordCount < 500) {
      return this.defaultCosts.rewrite.short;
    } else if (originalWordCount <= 1500) {
      return this.defaultCosts.rewrite.medium;
    } else {
      return this.defaultCosts.rewrite.long;
    }
  }

  /**
   * Calculate package discount
   */
  calculatePackageDiscount(basePrice, discountPercent) {
    if (!discountPercent || discountPercent <= 0) {
      return basePrice;
    }
    
    const discount = (basePrice * discountPercent) / 100;
    return Math.round((basePrice - discount) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate bulk pricing
   */
  calculateBulkPricing(credits, basePrice, bulkRules = []) {
    let finalPrice = basePrice;
    
    // Apply bulk discount rules
    for (const rule of bulkRules) {
      if (credits >= rule.minCredits) {
        const discountedPrice = this.calculatePackageDiscount(basePrice, rule.discountPercent);
        if (discountedPrice < finalPrice) {
          finalPrice = discountedPrice;
        }
      }
    }
    
    return finalPrice;
  }

  /**
   * Calculate credit value in money
   */
  calculateCreditValue(creditType, credits, packages = []) {
    const relevantPackages = packages.filter(pkg => pkg.credit_type === creditType);
    
    if (relevantPackages.length === 0) {
      // Default values if no packages available
      const defaultValues = {
        article: 75,  // 75 JPY per article credit
        image: 15,    // 15 JPY per image credit
        rewrite: 60   // 60 JPY per rewrite credit
      };
      return credits * (defaultValues[creditType] || 50);
    }
    
    // Find the package with best value (lowest price per credit)
    const bestPackage = relevantPackages.reduce((best, current) => {
      const currentValue = current.price / current.credits;
      const bestValue = best.price / best.credits;
      return currentValue < bestValue ? current : best;
    });
    
    const pricePerCredit = bestPackage.price / bestPackage.credits;
    return Math.round(credits * pricePerCredit * 100) / 100;
  }

  /**
   * Calculate remaining credits after deduction
   */
  calculateRemainingCredits(currentCredits, usedCredits) {
    const remaining = currentCredits - usedCredits;
    return Math.max(0, remaining); // Never go below 0
  }

  /**
   * Calculate credit usage statistics
   */
  calculateUsageStats(transactions = []) {
    const stats = {
      total_purchased: 0,
      total_used: 0,
      total_bonus: 0,
      total_refunded: 0,
      by_type: {
        article: { purchased: 0, used: 0, bonus: 0, refunded: 0 },
        image: { purchased: 0, used: 0, bonus: 0, refunded: 0 },
        rewrite: { purchased: 0, used: 0, bonus: 0, refunded: 0 }
      }
    };

    transactions.forEach(transaction => {
      const amount = Math.abs(transaction.amount);
      const type = transaction.credit_type;
      
      switch (transaction.transaction_type) {
        case 'purchase':
          stats.total_purchased += amount;
          if (stats.by_type[type]) {
            stats.by_type[type].purchased += amount;
          }
          break;
        case 'deduction':
          stats.total_used += amount;
          if (stats.by_type[type]) {
            stats.by_type[type].used += amount;
          }
          break;
        case 'bonus':
          stats.total_bonus += amount;
          if (stats.by_type[type]) {
            stats.by_type[type].bonus += amount;
          }
          break;
        case 'refund':
          stats.total_refunded += amount;
          if (stats.by_type[type]) {
            stats.by_type[type].refunded += amount;
          }
          break;
      }
    });

    return stats;
  }

  /**
   * Calculate cost efficiency
   */
  calculateCostEfficiency(generations = [], transactions = []) {
    const totalSpent = transactions
      .filter(t => t.transaction_type === 'purchase')
      .reduce((sum, t) => sum + (t.amount * this.getCreditCost(t.credit_type)), 0);
    
    const totalGenerations = generations.length;
    
    if (totalGenerations === 0) {
      return { cost_per_generation: 0, efficiency_score: 0 };
    }
    
    const costPerGeneration = totalSpent / totalGenerations;
    
    // Efficiency score (0-100, higher is better)
    // Based on average cost per generation compared to benchmark
    const benchmarkCost = 75; // 75 JPY per generation benchmark
    const efficiencyScore = Math.max(0, Math.min(100, 
      ((benchmarkCost - costPerGeneration) / benchmarkCost) * 100
    ));
    
    return {
      cost_per_generation: Math.round(costPerGeneration * 100) / 100,
      efficiency_score: Math.round(efficiencyScore)
    };
  }

  /**
   * Get default credit cost
   */
  getCreditCost(creditType) {
    const defaultCosts = {
      article: 75,
      image: 15,
      rewrite: 60
    };
    return defaultCosts[creditType] || 50;
  }

  /**
   * Calculate projected usage
   */
  calculateProjectedUsage(historicalUsage = [], days = 30) {
    if (historicalUsage.length === 0) {
      return { daily_average: 0, projected_monthly: 0, recommended_package: null };
    }

    // Calculate daily average for each credit type
    const totalDays = Math.max(1, historicalUsage.length);
    const dailyAverages = {
      article: 0,
      image: 0,
      rewrite: 0
    };

    historicalUsage.forEach(day => {
      Object.keys(dailyAverages).forEach(type => {
        dailyAverages[type] += (day[type] || 0) / totalDays;
      });
    });

    // Project monthly usage
    const monthlyProjection = {};
    Object.keys(dailyAverages).forEach(type => {
      monthlyProjection[type] = Math.ceil(dailyAverages[type] * days);
    });

    return {
      daily_average: dailyAverages,
      projected_monthly: monthlyProjection,
      total_projected: Object.values(monthlyProjection).reduce((sum, val) => sum + val, 0)
    };
  }
}

module.exports = new CreditCalculator();