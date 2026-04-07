const express = require('express');
const prisma = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Search auctions
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      q, category, condition, minPrice, maxPrice,
      sort = 'bestMatch', page = 1, limit = 20,
      type // 'auction' or 'buyitnow'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: 'ACTIVE' };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (category) where.category = category;
    if (condition) where.condition = condition;
    if (minPrice || maxPrice) {
      where.currentPrice = {};
      if (minPrice) where.currentPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.currentPrice.lte = parseFloat(maxPrice);
    }

    let orderBy;
    switch (sort) {
      case 'priceLow': orderBy = { currentPrice: 'asc' }; break;
      case 'priceHigh': orderBy = { currentPrice: 'desc' }; break;
      case 'endingSoon': orderBy = { endTime: 'asc' }; break;
      case 'newest': orderBy = { createdAt: 'desc' }; break;
      default: orderBy = { views: 'desc' }; // Best match = most viewed
    }

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, username: true, rating: true, positiveRate: true, totalRatings: true } },
          _count: { select: { bids: true } }
        },
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.auction.count({ where })
    ]);

    // Get categories for facets
    const categories = await prisma.auction.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE', ...(q ? { OR: where.OR } : {}) },
      _count: true,
      orderBy: { _count: { category: 'desc' } }
    });

    res.json({
      auctions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      facets: { categories }
    });
  } catch (error) {
    next(error);
  }
});

// Get categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.auction.groupBy({
      by: ['category'],
      where: { status: 'ACTIVE' },
      _count: true,
      orderBy: { _count: { category: 'desc' } }
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
