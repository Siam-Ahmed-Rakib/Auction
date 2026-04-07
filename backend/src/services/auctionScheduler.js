const cron = require('node-cron');
const prisma = require('../config/db');
const { createNotification } = require('./notificationService');

function startAuctionScheduler() {
  // Run every minute to check for ended auctions
  cron.schedule('* * * * *', async () => {
    try {
      const endedAuctions = await prisma.auction.findMany({
        where: {
          status: 'ACTIVE',
          endTime: { lte: new Date() }
        },
        include: {
          bids: {
            orderBy: { amount: 'desc' },
            take: 1,
            include: { bidder: true }
          }
        }
      });

      for (const auction of endedAuctions) {
        const winningBid = auction.bids[0];

        if (winningBid) {
          const meetsReserve = !auction.reservePrice || winningBid.amount >= auction.reservePrice;

          if (meetsReserve) {
            // Create order
            const orderNumber = `EB-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            await prisma.$transaction([
              prisma.auction.update({
                where: { id: auction.id },
                data: { status: 'SOLD' }
              }),
              prisma.order.create({
                data: {
                  orderNumber,
                  totalAmount: winningBid.amount + auction.shippingCost,
                  itemAmount: winningBid.amount,
                  shippingAmount: auction.shippingCost,
                  auctionId: auction.id,
                  buyerId: winningBid.bidderId,
                  sellerId: auction.sellerId
                }
              })
            ]);

            // Notify winner
            await createNotification({
              userId: winningBid.bidderId,
              type: 'AUCTION_WON',
              title: 'Congratulations! You won!',
              message: `You won "${auction.title}" for $${winningBid.amount.toFixed(2)}. Please complete payment.`,
              data: { auctionId: auction.id }
            });

            // Notify seller
            await createNotification({
              userId: auction.sellerId,
              type: 'AUCTION_ENDED',
              title: 'Your auction has sold!',
              message: `"${auction.title}" sold for $${winningBid.amount.toFixed(2)}.`,
              data: { auctionId: auction.id }
            });
          } else {
            // Reserve not met
            await prisma.auction.update({
              where: { id: auction.id },
              data: { status: 'RESERVE_NOT_MET' }
            });

            await createNotification({
              userId: auction.sellerId,
              type: 'AUCTION_ENDED',
              title: 'Reserve price not met',
              message: `"${auction.title}" ended without meeting the reserve price.`,
              data: { auctionId: auction.id }
            });
          }
        } else {
          // No bids
          await prisma.auction.update({
            where: { id: auction.id },
            data: { status: 'ENDED' }
          });

          await createNotification({
            userId: auction.sellerId,
            type: 'AUCTION_ENDED',
            title: 'Auction ended',
            message: `"${auction.title}" ended with no bids.`,
            data: { auctionId: auction.id }
          });
        }

        // Emit socket event
        try {
          const { getIO } = require('../socket');
          const io = getIO();
          io.to(`auction:${auction.id}`).emit('auction-ended', {
            auctionId: auction.id,
            winnerId: winningBid?.bidderId,
            finalPrice: winningBid?.amount
          });
        } catch (e) {}
      }
    } catch (error) {
      console.error('Auction scheduler error:', error.message);
    }
  });

  console.log('Auction scheduler started');
}

module.exports = { startAuctionScheduler };
