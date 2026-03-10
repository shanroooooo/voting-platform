const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const { redisUtils } = require('../config/redis');
const logger = require('../utils/logger');

class RecommendationService {
  constructor() {
    this.cacheTimeout = 3600; // 1 hour
  }

  // Get personalized restaurant recommendations for a user
  async getPersonalizedRecommendations(userId, limit = 10) {
    try {
      const cacheKey = `recommendations:${userId}`;
      
      // Try to get from cache first
      const cachedRecommendations = await redisUtils.get(cacheKey);
      if (cachedRecommendations) {
        return cachedRecommendations;
      }

      // Get user preferences and order history
      const user = await User.findById(userId)
        .populate('preferences.favoriteRestaurants')
        .populate('orderHistory');

      if (!user) {
        throw new Error('User not found');
      }

      // Extract user preferences
      const preferences = await this.extractUserPreferences(user);
      
      // Get recommendations based on different strategies
      const recommendations = await Promise.all([
        this.getCollaborativeFilteringRecommendations(userId, preferences),
        this.getContentBasedRecommendations(preferences),
        this.getTrendingRecommendations(),
        this.getLocationBasedRecommendations(user.addresses[0]?.coordinates),
      ]);

      // Combine and rank recommendations
      const combinedRecommendations = this.combineRecommendations(
        recommendations,
        preferences,
        limit
      );

      // Cache the results
      await redisUtils.setex(cacheKey, this.cacheTimeout, combinedRecommendations);

      return combinedRecommendations;
    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  // Extract user preferences from order history and profile
  async extractUserPreferences(user) {
    try {
      const preferences = {
        cuisines: {},
        priceRange: [],
        dietaryRestrictions: user.preferences.dietaryRestrictions || [],
        favoriteItems: {},
        orderTimes: [],
        orderFrequency: 0,
        averageOrderValue: 0,
        location: user.addresses[0]?.coordinates,
      };

      // Analyze order history
      if (user.orderHistory && user.orderHistory.length > 0) {
        const orders = await Order.find({ userId: user._id })
          .populate('restaurantId')
          .sort({ createdAt: -1 })
          .limit(50);

        preferences.orderFrequency = orders.length;

        let totalSpent = 0;
        orders.forEach(order => {
          // Cuisine preferences
          if (order.restaurantId) {
            const cuisine = order.restaurantId.cuisine;
            preferences.cuisines[cuisine] = (preferences.cuisines[cuisine] || 0) + 1;
          }

          // Price range analysis
          preferences.priceRange.push(order.pricing.total);
          totalSpent += order.pricing.total;

          // Order time patterns
          preferences.orderTimes.push(new Date(order.createdAt).getHours());

          // Favorite items
          order.items.forEach(item => {
            preferences.favoriteItems[item.name] = 
              (preferences.favoriteItems[item.name] || 0) + 1;
          });
        });

        preferences.averageOrderValue = totalSpent / orders.length;
      }

      // Add explicitly stated preferences
      if (user.preferences.cuisines) {
        user.preferences.cuisines.forEach(cuisine => {
          preferences.cuisines[cuisine] = (preferences.cuisines[cuisine] || 0) + 2; // Give more weight to explicit preferences
        });
      }

      return preferences;
    } catch (error) {
      logger.error('Error extracting user preferences:', error);
      return {
        cuisines: {},
        priceRange: [],
        dietaryRestrictions: [],
        favoriteItems: {},
        orderTimes: [],
        orderFrequency: 0,
        averageOrderValue: 0,
      };
    }
  }

  // Collaborative filtering recommendations
  async getCollaborativeFilteringRecommendations(userId, preferences) {
    try {
      // Find similar users based on order history
      const similarUsers = await this.findSimilarUsers(userId, preferences);
      
      if (similarUsers.length === 0) {
        return [];
      }

      // Get restaurants ordered by similar users but not by current user
      const userOrders = await Order.find({ userId }).distinct('restaurantId');
      
      const recommendations = await Order.aggregate([
        {
          $match: {
            userId: { $in: similarUsers.map(u => u._id) },
            restaurantId: { $nin: userOrders },
          },
        },
        {
          $group: {
            _id: '$restaurantId',
            orderCount: { $sum: 1 },
            averageRating: { $avg: '$review.rating' },
          },
        },
        { $sort: { orderCount: -1, averageRating: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'restaurants',
            localField: '_id',
            foreignField: '_id',
            as: 'restaurant',
          },
        },
        { $unwind: '$restaurant' },
      ]);

      return recommendations.map(rec => ({
        restaurant: rec.restaurant,
        score: rec.orderCount * 0.7 + (rec.averageRating || 0) * 0.3,
        reason: 'People with similar taste also liked this',
        type: 'collaborative',
      }));
    } catch (error) {
      logger.error('Error getting collaborative filtering recommendations:', error);
      return [];
    }
  }

  // Content-based recommendations
  async getContentBasedRecommendations(preferences) {
    try {
      const query = {
        isActive: true,
        isVerified: true,
      };

      // Build query based on preferences
      if (preferences.cuisines && Object.keys(preferences.cuisines).length > 0) {
        const preferredCuisines = Object.keys(preferences.cuisines)
          .sort((a, b) => preferences.cuisines[b] - preferences.cuisines[a])
          .slice(0, 5); // Top 5 preferred cuisines
        
        query.cuisine = { $in: preferredCuisines };
      }

      // Add dietary restrictions
      if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
        query['menu.items.dietaryInfo'] = { $in: preferences.dietaryRestrictions };
      }

      // Add price range preference
      if (preferences.priceRange && preferences.priceRange.length > 0) {
        const avgPrice = preferences.priceRange.reduce((a, b) => a + b, 0) / preferences.priceRange.length;
        const priceRange = avgPrice < 20 ? '$' : avgPrice < 40 ? '$$' : avgPrice < 60 ? '$$$' : '$$$$';
        query.priceRange = { $in: [priceRange, '$$', '$$$'] }; // Include nearby price ranges
      }

      const restaurants = await Restaurant.find(query)
        .sort({ 'rating.average': -1, 'stats.totalOrders': -1 })
        .limit(20);

      return restaurants.map(restaurant => ({
        restaurant,
        score: this.calculateContentScore(restaurant, preferences),
        reason: this.generateContentReason(restaurant, preferences),
        type: 'content',
      }));
    } catch (error) {
      logger.error('Error getting content-based recommendations:', error);
      return [];
    }
  }

  // Trending recommendations
  async getTrendingRecommendations() {
    try {
      const cacheKey = 'trending:restaurants';
      
      // Try cache first
      const cachedTrending = await redisUtils.get(cacheKey);
      if (cachedTrending) {
        return cachedTrending;
      }

      // Get trending restaurants based on recent orders and ratings
      const trending = await Restaurant.aggregate([
        {
          $match: {
            isActive: true,
            isVerified: true,
            'rating.count': { $gte: 10 }, // Minimum reviews
          },
        },
        {
          $addFields: {
            trendingScore: {
              $add: [
                { $multiply: ['$rating.average', 0.4] },
                { $multiply: [{ $divide: ['$stats.totalOrders', { $subtract: [new Date(), '$createdAt'] }] }, 0.3] },
                { $multiply: [{ $divide: ['$reviews', { $subtract: [new Date(), '$createdAt'] }] }, 0.3] },
              ],
            },
          },
        },
        { $sort: { trendingScore: -1 } },
        { $limit: 15 },
      ]);

      const recommendations = trending.map(restaurant => ({
        restaurant,
        score: restaurant.trendingScore,
        reason: 'Trending in your area',
        type: 'trending',
      }));

      // Cache for 30 minutes
      await redisUtils.setex(cacheKey, 1800, recommendations);

      return recommendations;
    } catch (error) {
      logger.error('Error getting trending recommendations:', error);
      return [];
    }
  }

  // Location-based recommendations
  async getLocationBasedRecommendations(userLocation) {
    try {
      if (!userLocation) {
        return [];
      }

      const nearbyRestaurants = await Restaurant.findNearby(userLocation, 5) // 5 miles
        .populate('owner', 'name')
        .limit(10);

      return nearbyRestaurants.map(restaurant => ({
        restaurant,
        score: this.calculateLocationScore(restaurant, userLocation),
        reason: 'Popular near you',
        type: 'location',
      }));
    } catch (error) {
      logger.error('Error getting location-based recommendations:', error);
      return [];
    }
  }

  // Find similar users based on preferences and order history
  async findSimilarUsers(userId, preferences) {
    try {
      const similarUsers = await User.aggregate([
        {
          $match: {
            _id: { $ne: userId },
            isActive: true,
            'preferences.cuisines': { $exists: true, $ne: [] },
          },
        },
        {
          $addFields: {
            similarityScore: this.calculateUserSimilarity(preferences, '$preferences'),
          },
        },
        { $sort: { similarityScore: -1 } },
        { $limit: 10 },
      ]);

      return similarUsers;
    } catch (error) {
      logger.error('Error finding similar users:', error);
      return [];
    }
  }

  // Calculate similarity between two users
  calculateUserSimilarity(user1Prefs, user2Prefs) {
    // Simplified similarity calculation
    // In a real implementation, this would use more sophisticated algorithms
    let similarity = 0;
    let totalFactors = 0;

    // Cuisine similarity
    const cuisines1 = Object.keys(user1Prefs.cuisines);
    const cuisines2 = user2Prefs.cuisines || [];
    
    cuisines1.forEach(cuisine => {
      if (cuisines2.includes(cuisine)) {
        similarity += 1;
      }
      totalFactors += 1;
    });

    // Dietary restrictions similarity
    if (user1Prefs.dietaryRestrictions && user2Prefs.dietaryRestrictions) {
      const commonDietary = user1Prefs.dietaryRestrictions.filter(d => 
        user2Prefs.dietaryRestrictions.includes(d)
      );
      similarity += commonDietary.length / Math.max(user1Prefs.dietaryRestrictions.length, 1);
      totalFactors += 1;
    }

    return totalFactors > 0 ? similarity / totalFactors : 0;
  }

  // Calculate content-based score
  calculateContentScore(restaurant, preferences) {
    let score = 0;

    // Cuisine preference score
    if (preferences.cuisines[restaurant.cuisine]) {
      score += preferences.cuisines[restaurant.cuisine] * 0.3;
    }

    // Rating score
    score += (restaurant.rating.average || 0) * 0.2;

    // Price range match
    if (preferences.priceRange && preferences.priceRange.length > 0) {
      const avgPrice = preferences.priceRange.reduce((a, b) => a + b, 0) / preferences.priceRange.length;
      const restaurantPriceValue = this.getPriceRangeValue(restaurant.priceRange);
      const priceDiff = Math.abs(avgPrice - restaurantPriceValue);
      score += Math.max(0, 1 - priceDiff / 50) * 0.2; // Normalize and weight
    }

    // Dietary restrictions match
    if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
      const matchingItems = restaurant.menu.filter(category =>
        category.items.some(item =>
          item.dietaryInfo && item.dietaryInfo.some(diet =>
            preferences.dietaryRestrictions.includes(diet)
          )
        )
      );
      score += (matchingItems.length / restaurant.menu.length) * 0.2;
    }

    // Popularity score
    score += Math.min(restaurant.stats.totalOrders / 100, 1) * 0.1;

    return score;
  }

  // Generate content-based recommendation reason
  generateContentReason(restaurant, preferences) {
    const reasons = [];

    if (preferences.cuisines[restaurant.cuisine]) {
      reasons.push(`You like ${restaurant.cuisine} food`);
    }

    if (restaurant.rating.average >= 4.5) {
      reasons.push('Highly rated');
    }

    if (restaurant.stats.totalOrders > 100) {
      reasons.push('Popular choice');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Recommended for you';
  }

  // Calculate location-based score
  calculateLocationScore(restaurant, userLocation) {
    const distance = this.calculateDistance(userLocation, restaurant.address.coordinates);
    
    // Score decreases with distance
    const distanceScore = Math.max(0, 1 - distance / 10); // Normalize to 10 miles max
    
    // Combine with rating
    return (distanceScore * 0.6) + ((restaurant.rating.average || 0) / 5 * 0.4);
  }

  // Calculate distance between two points
  calculateDistance(point1, point2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  // Convert price range to numeric value
  getPriceRangeValue(priceRange) {
    const values = { '$': 15, '$$': 35, '$$$': 55, '$$$$': 80 };
    return values[priceRange] || 35;
  }

  // Combine recommendations from different sources
  combineRecommendations(recommendations, preferences, limit) {
    try {
      // Flatten all recommendations
      const allRecs = recommendations.flat();

      // Group by restaurant ID
      const restaurantMap = new Map();
      
      allRecs.forEach(rec => {
        const restaurantId = rec.restaurant._id.toString();
        
        if (!restaurantMap.has(restaurantId)) {
          restaurantMap.set(restaurantId, {
            restaurant: rec.restaurant,
            scores: [],
            reasons: [],
            types: [],
          });
        }
        
        const existing = restaurantMap.get(restaurantId);
        existing.scores.push(rec.score);
        existing.reasons.push(rec.reason);
        existing.types.push(rec.type);
      });

      // Calculate final scores and sort
      const combinedRecs = Array.from(restaurantMap.values()).map(item => {
        // Weight different recommendation types
        const typeWeights = {
          collaborative: 0.35,
          content: 0.30,
          trending: 0.20,
          location: 0.15,
        };

        let weightedScore = 0;
        item.scores.forEach((score, index) => {
          const type = item.types[index];
          const weight = typeWeights[type] || 0.25;
          weightedScore += score * weight;
        });

        // Add diversity boost for less popular restaurants
        const popularityBoost = Math.min(50 / (item.restaurant.stats.totalOrders || 1), 0.2);
        weightedScore += popularityBoost;

        return {
          restaurant: item.restaurant,
          score: weightedScore,
          reasons: [...new Set(item.reasons)], // Remove duplicates
          types: [...new Set(item.types)],
        };
      });

      // Sort by score and return top recommendations
      return combinedRecs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error combining recommendations:', error);
      return [];
    }
  }

  // Update user preferences based on new order
  async updateUserPreferences(userId, orderId) {
    try {
      const order = await Order.findById(orderId).populate('restaurantId');
      if (!order) return;

      const user = await User.findById(userId);
      if (!user) return;

      // Update cuisine preferences
      const cuisine = order.restaurantId.cuisine;
      if (!user.preferences.cuisines) {
        user.preferences.cuisines = [];
      }
      
      if (!user.preferences.cuisines.includes(cuisine)) {
        user.preferences.cuisines.push(cuisine);
      }

      // Update favorite restaurants
      if (!user.preferences.favoriteRestaurants) {
        user.preferences.favoriteRestaurants = [];
      }
      
      if (!user.preferences.favoriteRestaurants.includes(order.restaurantId._id)) {
        user.preferences.favoriteRestaurants.push(order.restaurantId._id);
      }

      await user.save();

      // Clear recommendation cache for this user
      await redisUtils.del(`recommendations:${userId}`);

      logger.info(`Updated preferences for user ${userId}`);
    } catch (error) {
      logger.error('Error updating user preferences:', error);
    }
  }

  // Get restaurant recommendations for a specific cuisine
  async getCuisineRecommendations(cuisine, limit = 10) {
    try {
      const cacheKey = `cuisine:${cuisine}:recommendations`;
      
      const cached = await redisUtils.get(cacheKey);
      if (cached) {
        return cached;
      }

      const restaurants = await Restaurant.find({
        cuisine: cuisine.toLowerCase(),
        isActive: true,
        isVerified: true,
      })
        .sort({ 'rating.average': -1, 'stats.totalOrders': -1 })
        .limit(limit);

      const recommendations = restaurants.map(restaurant => ({
        restaurant,
        score: (restaurant.rating.average || 0) * 0.6 + (restaurant.stats.totalOrders / 100) * 0.4,
        reason: `Top ${cuisine} restaurant`,
        type: 'cuisine',
      }));

      await redisUtils.setex(cacheKey, this.cacheTimeout, recommendations);

      return recommendations;
    } catch (error) {
      logger.error('Error getting cuisine recommendations:', error);
      return [];
    }
  }
}

module.exports = RecommendationService;
