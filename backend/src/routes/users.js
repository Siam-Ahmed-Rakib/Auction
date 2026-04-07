const express = require('express');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, name: true, avatarUrl: true,
        rating: true, totalRatings: true, positiveRate: true,
        createdAt: true,
        _count: { select: { auctions: true } }
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Get user's watchlist
router.get('/me/watchlist', auth, async (req, res, next) => {
  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      include: {
        auction: {
          include: {
            seller: { select: { id: true, username: true } },
            _count: { select: { bids: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(watchlist.map(w => w.auction));
  } catch (error) {
    next(error);
  }
});

// Get dashboard stats
router.get('/me/stats', auth, async (req, res, next) => {
  try {
    const [
      activeBids, wonItems, lostBids, activeListings,
      soldItems, totalSpent, totalEarned
    ] = await Promise.all([
      prisma.bid.count({
        where: {
          bidderId: req.user.id,
          isWinning: true,
          auction: { status: 'ACTIVE' }
        }
      }),
      prisma.order.count({ where: { buyerId: req.user.id } }),
      prisma.bid.count({
        where: {
          bidderId: req.user.id,
          auction: { status: { in: ['ENDED', 'SOLD', 'RESERVE_NOT_MET'] } },
          isWinning: false
        }
      }),
      prisma.auction.count({ where: { sellerId: req.user.id, status: 'ACTIVE' } }),
      prisma.auction.count({ where: { sellerId: req.user.id, status: 'SOLD' } }),
      prisma.order.aggregate({
        where: { buyerId: req.user.id, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true }
      }),
      prisma.order.aggregate({
        where: { sellerId: req.user.id, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true }
      })
    ]);

    res.json({
      activeBids,
      wonItems,
      lostBids,
      activeListings,
      soldItems,
      totalSpent: totalSpent._sum.totalAmount || 0,
      totalEarned: totalEarned._sum.totalAmount || 0
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
