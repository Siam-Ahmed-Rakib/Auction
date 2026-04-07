const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/db');
const { auth } = require('../middleware/auth');
const { processBid } = require('../services/biddingEngine');

const router = express.Router();

// Place a bid (with proxy bidding support)
router.post('/:auctionId', auth, [
  body('amount').isFloat({ min: 0.01 }),
  body('maxBid').optional().isFloat({ min: 0.01 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { auctionId } = req.params;
    const { amount, maxBid } = req.body;
    const bidderId = req.user.id;

    const result = await processBid({
      auctionId,
      bidderId,
      amount: parseFloat(amount),
      maxBid: maxBid ? parseFloat(maxBid) : parseFloat(amount)
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('Cannot') || error.message.includes('must') || error.message.includes('has ended') || error.message.includes('own auction')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Get bids for an auction
router.get('/auction/:auctionId', async (req, res, next) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { auctionId: req.params.auctionId },
      include: {
        bidder: { select: { id: true, username: true, rating: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Mask max bids for privacy
    const maskedBids = bids.map(bid => ({
      ...bid,
      maxBid: undefined
    }));

    res.json(maskedBids);
  } catch (error) {
    next(error);
  }
});

// Get user's bids
router.get('/user/my-bids', auth, async (req, res, next) => {
  try {
    const { status } = req.query;

    let auctionStatus;
    if (status === 'active') auctionStatus = 'ACTIVE';
    else if (status === 'won') auctionStatus = 'SOLD';
    else if (status === 'lost') auctionStatus = ['ENDED', 'RESERVE_NOT_MET'];

    // Get all auctions the user has bid on
    const bids = await prisma.bid.findMany({
      where: { bidderId: req.user.id },
      distinct: ['auctionId'],
      orderBy: { createdAt: 'desc' },
      include: {
        auction: {
          include: {
            seller: { select: { id: true, username: true, rating: true, positiveRate: true } },
            _count: { select: { bids: true } },
            bids: { orderBy: { amount: 'desc' }, take: 1 }
          }
        }
      }
    });

    // Get user's max bid per auction
    const auctionIds = bids.map(b => b.auctionId);
    const userMaxBids = await prisma.bid.groupBy({
      by: ['auctionId'],
      where: { bidderId: req.user.id, auctionId: { in: auctionIds } },
      _max: { maxBid: true, amount: true }
    });

    const maxBidMap = {};
    userMaxBids.forEach(b => { maxBidMap[b.auctionId] = b._max; });

    let results = bids.map(bid => {
      const auction = bid.auction;
      const highestBid = auction.bids[0];
      const isWinning = highestBid && highestBid.bidderId === req.user.id;
      const userMax = maxBidMap[auction.id];

      let bidStatus = 'active';
      if (auction.status === 'SOLD' || auction.status === 'ENDED') {
        bidStatus = isWinning ? 'won' : 'lost';
      } else if (auction.status === 'ACTIVE') {
        bidStatus = isWinning ? 'winning' : 'outbid';
      }

      return {
        auction: {
          ...auction,
          bids: undefined // remove raw bids
        },
        userMaxBid: userMax?.maxBid,
        userCurrentBid: userMax?.amount,
        highestBid: highestBid?.amount,
        isWinning,
        bidStatus,
        bidCount: auction._count.bids
      };
    });

    // Filter by status
    if (status === 'active') {
      results = results.filter(r => r.auction.status === 'ACTIVE');
    } else if (status === 'won') {
      results = results.filter(r => r.bidStatus === 'won');
    } else if (status === 'lost') {
      results = results.filter(r => r.bidStatus === 'lost');
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
