const express = require('express');
const { body, query, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all active auctions (with filters)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, category, condition,
      minPrice, maxPrice, sort = 'endTime', order = 'asc',
      status = 'ACTIVE'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { status };
    if (category) where.category = category;
    if (condition) where.condition = condition;
    if (minPrice || maxPrice) {
      where.currentPrice = {};
      if (minPrice) where.currentPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.currentPrice.lte = parseFloat(maxPrice);
    }

    const orderBy = {};
    if (sort === 'price') orderBy.currentPrice = order;
    else if (sort === 'newest') orderBy.createdAt = 'desc';
    else if (sort === 'bids') orderBy.bids = { _count: order };
    else orderBy.endTime = order;

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          seller: { select: { id: true, username: true, rating: true, positiveRate: true, totalRatings: true } },
          _count: { select: { bids: true, watchlist: true } }
        },
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.auction.count({ where })
    ]);

    res.json({
      auctions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single auction
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: {
        seller: {
          select: {
            id: true, username: true, name: true, rating: true,
            positiveRate: true, totalRatings: true, avatarUrl: true, createdAt: true
          }
        },
        bids: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            bidder: { select: { id: true, username: true } }
          }
        },
        _count: { select: { bids: true, watchlist: true } }
      }
    });

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Increment views
    await prisma.auction.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } }
    });

    // Check if user is watching
    let isWatching = false;
    if (req.user) {
      const watch = await prisma.watchlist.findUnique({
        where: { userId_auctionId: { userId: req.user.id, auctionId: auction.id } }
      });
      isWatching = !!watch;
    }

    res.json({ ...auction, isWatching });
  } catch (error) {
    next(error);
  }
});

// Create auction
router.post('/', auth, [
  body('title').isLength({ min: 3, max: 200 }).trim(),
  body('description').isLength({ min: 10 }).trim(),
  body('category').notEmpty().trim(),
  body('startPrice').isFloat({ min: 0.01 }),
  body('duration').isInt({ min: 1, max: 30 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title, description, images = [], category, condition = 'New',
      startPrice, reservePrice, duration, bidIncrement = 1,
      shippingCost = 0, shippingMethod, location, returnPolicy,
      startImmediately = true
    } = req.body;

    const startTime = startImmediately ? new Date() : new Date(req.body.startTime);
    const endTime = new Date(startTime.getTime() + duration * 24 * 60 * 60 * 1000);

    const auction = await prisma.auction.create({
      data: {
        title,
        description,
        images,
        category,
        condition,
        startPrice: parseFloat(startPrice),
        reservePrice: reservePrice ? parseFloat(reservePrice) : null,
        currentPrice: parseFloat(startPrice),
        bidIncrement: parseFloat(bidIncrement),
        startTime,
        endTime,
        status: startImmediately ? 'ACTIVE' : 'DRAFT',
        shippingCost: parseFloat(shippingCost),
        shippingMethod,
        location,
        returnPolicy,
        sellerId: req.user.id
      },
      include: {
        seller: { select: { id: true, username: true, rating: true } }
      }
    });

    res.status(201).json(auction);
  } catch (error) {
    next(error);
  }
});

// Update auction (only if DRAFT or no bids)
router.put('/:id', auth, async (req, res, next) => {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { bids: true } } }
    });

    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.sellerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (auction._count.bids > 0) return res.status(400).json({ error: 'Cannot edit auction with bids' });

    const {
      title, description, images, category, condition,
      startPrice, reservePrice, bidIncrement,
      shippingCost, shippingMethod, location, returnPolicy
    } = req.body;

    const updated = await prisma.auction.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(images && { images }),
        ...(category && { category }),
        ...(condition && { condition }),
        ...(startPrice && { startPrice: parseFloat(startPrice), currentPrice: parseFloat(startPrice) }),
        ...(reservePrice !== undefined && { reservePrice: reservePrice ? parseFloat(reservePrice) : null }),
        ...(bidIncrement && { bidIncrement: parseFloat(bidIncrement) }),
        ...(shippingCost !== undefined && { shippingCost: parseFloat(shippingCost) }),
        ...(shippingMethod !== undefined && { shippingMethod }),
        ...(location !== undefined && { location }),
        ...(returnPolicy !== undefined && { returnPolicy })
      },
      include: {
        seller: { select: { id: true, username: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Cancel auction
router.post('/:id/cancel', auth, async (req, res, next) => {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { bids: true } } }
    });

    if (!auction) return res.status(404).json({ error: 'Auction not found' });
    if (auction.sellerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (auction._count.bids > 0) return res.status(400).json({ error: 'Cannot cancel auction with bids' });

    const updated = await prisma.auction.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Toggle watchlist
router.post('/:id/watch', auth, async (req, res, next) => {
  try {
    const existing = await prisma.watchlist.findUnique({
      where: { userId_auctionId: { userId: req.user.id, auctionId: req.params.id } }
    });

    if (existing) {
      await prisma.watchlist.delete({ where: { id: existing.id } });
      res.json({ watching: false });
    } else {
      await prisma.watchlist.create({
        data: { userId: req.user.id, auctionId: req.params.id }
      });
      res.json({ watching: true });
    }
  } catch (error) {
    next(error);
  }
});

// Get user's selling auctions
router.get('/user/selling', auth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { sellerId: req.user.id };
    if (status) where.status = status;

    const auctions = await prisma.auction.findMany({
      where,
      include: {
        _count: { select: { bids: true } },
        bids: { orderBy: { amount: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(auctions);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
