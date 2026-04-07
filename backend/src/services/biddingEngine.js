const prisma = require('../config/db');
const { getIO } = require('../socket');
const { createNotification } = require('./notificationService');

async function processBid({ auctionId, bidderId, amount, maxBid }) {
  // Get auction with current highest bid
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
        include: { bidder: { select: { id: true, username: true } } }
      }
    }
  });

  if (!auction) throw new Error('Auction not found');
  if (auction.status !== 'ACTIVE') throw new Error('Auction has ended or is not active');
  if (new Date() > new Date(auction.endTime)) throw new Error('Auction has ended');
  if (auction.sellerId === bidderId) throw new Error('Cannot bid on your own auction');

  const currentHighestBid = auction.bids[0];
  const minimumBid = currentHighestBid
    ? currentHighestBid.amount + auction.bidIncrement
    : auction.startPrice;

  if (amount < minimumBid) {
    throw new Error(`Bid must be at least $${minimumBid.toFixed(2)}`);
  }

  if (maxBid < amount) {
    throw new Error('Maximum bid must be greater than or equal to bid amount');
  }

  let io;
  try { io = getIO(); } catch (e) { io = null; }

  // Check if there's an existing proxy bid that's higher
  if (currentHighestBid && currentHighestBid.bidderId !== bidderId) {
    // Get the previous bidder's max proxy bid
    const previousMaxBid = await prisma.bid.findFirst({
      where: { auctionId, bidderId: currentHighestBid.bidderId },
      orderBy: { maxBid: 'desc' }
    });

    if (previousMaxBid && previousMaxBid.maxBid >= maxBid) {
      // Previous proxy bid is higher - auto-outbid the new bidder
      const newCurrentPrice = Math.min(
        previousMaxBid.maxBid,
        maxBid + auction.bidIncrement
      );

      // Create the new bidder's bid (which gets outbid)
      const newBid = await prisma.bid.create({
        data: {
          amount: amount,
          maxBid: maxBid,
          isProxy: maxBid > amount,
          isWinning: false,
          auctionId,
          bidderId
        }
      });

      // Create proxy bid for previous bidder
      const proxyBid = await prisma.bid.create({
        data: {
          amount: newCurrentPrice,
          maxBid: previousMaxBid.maxBid,
          isProxy: true,
          isWinning: true,
          auctionId,
          bidderId: currentHighestBid.bidderId
        }
      });

      // Mark previous winning bid as not winning
      if (currentHighestBid) {
        await prisma.bid.update({
          where: { id: currentHighestBid.id },
          data: { isWinning: false }
        });
      }

      // Update auction price
      await prisma.auction.update({
        where: { id: auctionId },
        data: { currentPrice: newCurrentPrice }
      });

      // Notify the new bidder they were outbid
      await createNotification({
        userId: bidderId,
        type: 'OUTBID',
        title: 'You\'ve been outbid!',
        message: `Someone has a higher maximum bid on "${auction.title}". Current price: $${newCurrentPrice.toFixed(2)}`,
        data: { auctionId }
      });

      // Emit socket events
      if (io) {
        io.to(`auction:${auctionId}`).emit('bid-update', {
          auctionId,
          currentPrice: newCurrentPrice,
          bidCount: await prisma.bid.count({ where: { auctionId } }),
          highestBidderId: currentHighestBid.bidderId
        });
        io.to(`user:${bidderId}`).emit('outbid', { auctionId, title: auction.title });
      }

      return {
        bid: newBid,
        isHighestBidder: false,
        currentPrice: newCurrentPrice,
        message: 'You were outbid by automatic bidding. Try a higher maximum bid.'
      };
    }
  }

  // New bid wins (or there's no previous proxy bid higher)
  let newCurrentPrice;
  if (currentHighestBid && currentHighestBid.bidderId !== bidderId) {
    // Get previous max proxy bid
    const previousMaxBid = await prisma.bid.findFirst({
      where: { auctionId, bidderId: currentHighestBid.bidderId },
      orderBy: { maxBid: 'desc' }
    });

    if (previousMaxBid) {
      newCurrentPrice = Math.min(maxBid, previousMaxBid.maxBid + auction.bidIncrement);
    } else {
      newCurrentPrice = amount;
    }
  } else {
    newCurrentPrice = amount;
  }

  // Mark previous winning bids as not winning
  await prisma.bid.updateMany({
    where: { auctionId, isWinning: true },
    data: { isWinning: false }
  });

  // Create the winning bid
  const bid = await prisma.bid.create({
    data: {
      amount: newCurrentPrice,
      maxBid: maxBid,
      isProxy: maxBid > newCurrentPrice,
      isWinning: true,
      auctionId,
      bidderId
    },
    include: {
      bidder: { select: { id: true, username: true } }
    }
  });

  // Update auction current price
  await prisma.auction.update({
    where: { id: auctionId },
    data: { currentPrice: newCurrentPrice }
  });

  // Notify previous highest bidder they were outbid
  if (currentHighestBid && currentHighestBid.bidderId !== bidderId) {
    await createNotification({
      userId: currentHighestBid.bidderId,
      type: 'OUTBID',
      title: 'You\'ve been outbid!',
      message: `Another bidder has outbid you on "${auction.title}". Current price: $${newCurrentPrice.toFixed(2)}`,
      data: { auctionId }
    });

    if (io) {
      io.to(`user:${currentHighestBid.bidderId}`).emit('outbid', {
        auctionId,
        title: auction.title,
        currentPrice: newCurrentPrice
      });
    }
  }

  // Notify bid placed
  await createNotification({
    userId: bidderId,
    type: 'BID_PLACED',
    title: 'Bid placed!',
    message: `Your bid of $${newCurrentPrice.toFixed(2)} on "${auction.title}" was placed successfully.`,
    data: { auctionId }
  });

  // Emit socket events
  if (io) {
    io.to(`auction:${auctionId}`).emit('bid-update', {
      auctionId,
      currentPrice: newCurrentPrice,
      bidCount: await prisma.bid.count({ where: { auctionId } }),
      highestBidderId: bidderId,
      bidderUsername: bid.bidder.username
    });
  }

  return {
    bid: { ...bid, maxBid: undefined },
    isHighestBidder: true,
    currentPrice: newCurrentPrice,
    message: `You're the highest bidder at $${newCurrentPrice.toFixed(2)}`
  };
}

module.exports = { processBid };
