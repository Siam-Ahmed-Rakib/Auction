'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { formatPrice, formatDate } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import { Heart, Share2, AlertCircle, CheckCircle2, Shield, ChevronDown, Eye, Clock } from 'lucide-react';

export default function AuctionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const socket = useSocket();

  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [maxBid, setMaxBid] = useState('');
  const [showBidModal, setShowBidModal] = useState(false);
  const [showBidSuccess, setShowBidSuccess] = useState(false);
  const [bidResult, setBidResult] = useState(null);
  const [bidError, setBidError] = useState('');
  const [bidding, setBidding] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShipping, setShowShipping] = useState(false);

  const loadAuction = useCallback(async () => {
    try {
      const data = await api.getAuction(id);
      setAuction(data);
      setIsWatching(data.isWatching || false);
      const minBid = data.bids?.length > 0
        ? data.currentPrice + data.bidIncrement
        : data.startPrice;
      setBidAmount(minBid.toFixed(2));
      setMaxBid(minBid.toFixed(2));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAuction();
  }, [loadAuction]);

  useEffect(() => {
    if (socket && id) {
      socket.emit('join-auction', id);
      socket.on('bid-update', (data) => {
        if (data.auctionId === id) {
          setAuction(prev => prev ? {
            ...prev,
            currentPrice: data.currentPrice,
            _count: { ...prev._count, bids: data.bidCount }
          } : prev);
        }
      });
      return () => {
        socket.emit('leave-auction', id);
        socket.off('bid-update');
      };
    }
  }, [socket, id]);

  const handlePlaceBid = async () => {
    if (!user) return router.push('/auth/login');
    setBidError('');
    setBidding(true);
    try {
      const result = await api.placeBid(id, {
        amount: parseFloat(bidAmount),
        maxBid: parseFloat(maxBid) || parseFloat(bidAmount)
      });
      setBidResult(result);
      setShowBidModal(false);
      setShowBidSuccess(true);
      loadAuction();
    } catch (err) {
      setBidError(err.message);
    } finally {
      setBidding(false);
    }
  };

  const handleWatch = async () => {
    if (!user) return router.push('/auth/login');
    try {
      const result = await api.toggleWatch(id);
      setIsWatching(result.watching);
    } catch (err) {}
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-200 h-96 rounded-lg" />
          <div className="space-y-4">
            <div className="bg-gray-200 h-8 rounded w-3/4" />
            <div className="bg-gray-200 h-12 rounded w-1/3" />
            <div className="bg-gray-200 h-12 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return <div className="max-w-[1400px] mx-auto px-4 py-16 text-center text-ebay-gray">Auction not found</div>;
  }

  const bidCount = auction._count?.bids || 0;
  const minBid = bidCount > 0 ? auction.currentPrice + auction.bidIncrement : auction.startPrice;
  const isActive = auction.status === 'ACTIVE';
  const isSeller = user?.id === auction.sellerId;

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      {/* Breadcrumb */}
      <div className="text-xs text-ebay-gray mb-4">
        <Link href="/" className="hover:underline">Home</Link> {' > '}
        <Link href={`/search?category=${encodeURIComponent(auction.category)}`} className="hover:underline">{auction.category}</Link> {' > '}
        <span className="text-ebay-dark">{auction.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        {/* Left: Images */}
        <div>
          {/* Views badge */}
          {auction.views > 100 && (
            <div className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded mb-3">
              <Eye className="w-3 h-3" />
              {auction.views} VIEWED IN THE LAST 24 HOURS
            </div>
          )}

          <div className="bg-gray-100 rounded-lg h-[400px] lg:h-[500px] flex items-center justify-center relative">
            {auction.images?.[0] ? (
              <img src={auction.images[0]} alt={auction.title} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-8xl">📦</div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm text-ebay-gray">
            <button className="flex items-center gap-1 hover:text-ebay-blue">
              <Share2 className="w-4 h-4" /> Share this item
            </button>
          </div>
        </div>

        {/* Right: Details */}
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-ebay-dark">{auction.title}</h1>

          {/* Seller info */}
          <div className="flex items-center gap-2 mt-3">
            <div className="w-8 h-8 bg-ebay-blue rounded-full flex items-center justify-center text-white text-sm font-bold">
              {auction.seller.username[0].toUpperCase()}
            </div>
            <div>
              <Link href={`/users/${auction.seller.id}`} className="text-sm text-ebay-blue hover:underline font-medium">
                {auction.seller.username}
              </Link>
              <p className="text-xs text-ebay-gray">
                {auction.seller.positiveRate > 0 && <span className="text-green-700">{auction.seller.positiveRate}% positive</span>}
                {auction.seller.totalRatings > 0 && <span> · {auction.seller.totalRatings} ratings</span>}
              </p>
            </div>
          </div>

          {/* Condition */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-ebay-gray">Condition:</span>
            <span className="text-sm font-medium">{auction.condition}</span>
          </div>

          {/* Price section */}
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-ebay-gray">Current bid:</div>
            <div className="text-3xl font-bold text-ebay-dark mt-1">
              {formatPrice(auction.currentPrice)}
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-ebay-gray">
              <span>{bidCount} bid{bidCount !== 1 ? 's' : ''}</span>
              {isActive && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <CountdownTimer endTime={auction.endTime} />
                </span>
              )}
            </div>

            {isActive && !isSeller && (
              <div className="mt-4 space-y-2">
                <div>
                  <label className="text-xs text-ebay-gray">Your max bid:</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium">US $</span>
                    <input
                      type="number"
                      step="0.01"
                      min={minBid}
                      value={bidAmount}
                      onChange={(e) => {
                        setBidAmount(e.target.value);
                        setMaxBid(e.target.value);
                      }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder={minBid.toFixed(2)}
                    />
                  </div>
                  <p className="text-xs text-ebay-gray mt-1">Enter {formatPrice(minBid)} or more</p>
                </div>

                <button
                  onClick={() => setShowBidModal(true)}
                  className="w-full bid-btn text-white rounded-full py-3 font-medium text-sm"
                >
                  Place bid
                </button>
              </div>
            )}

            {auction.status === 'SOLD' && (
              <div className="mt-4 bg-green-50 rounded-lg p-3 text-green-800 text-sm font-medium">
                This auction has ended - Item sold!
              </div>
            )}

            {auction.status === 'ENDED' && (
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-gray-600 text-sm">
                This auction has ended with no winner.
              </div>
            )}

            {isSeller && isActive && (
              <div className="mt-4 bg-blue-50 rounded-lg p-3 text-blue-800 text-sm">
                This is your listing. You cannot bid on it.
              </div>
            )}
          </div>

          {/* Watch button */}
          <button
            onClick={handleWatch}
            className={`mt-3 w-full border rounded-full py-2.5 text-sm font-medium transition flex items-center justify-center gap-2 ${
              isWatching ? 'border-ebay-blue text-ebay-blue bg-blue-50' : 'border-gray-300 text-ebay-dark hover:border-ebay-dark'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWatching ? 'fill-ebay-blue' : ''}`} />
            {isWatching ? 'Watching' : 'Add to Watchlist'}
          </button>

          {/* Shipping info */}
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-ebay-gray min-w-[80px]">Shipping:</span>
              <div>
                {auction.shippingCost > 0 ? (
                  <span>{formatPrice(auction.shippingCost)} {auction.shippingMethod || 'Standard Shipping'}</span>
                ) : (
                  <span className="text-green-700 font-medium">FREE Shipping</span>
                )}
                {auction.location && (
                  <p className="text-xs text-ebay-gray">Located in: {auction.location}</p>
                )}
              </div>
            </div>
            {auction.returnPolicy && (
              <div className="flex items-start gap-3">
                <span className="text-ebay-gray min-w-[80px]">Returns:</span>
                <span>{auction.returnPolicy}</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <span className="text-ebay-gray min-w-[80px]">Payments:</span>
              <span>All major payment methods accepted</span>
            </div>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="font-bold text-sm">AuctionHub Money Back Guarantee</span>
            </div>
            <p className="text-xs text-ebay-gray mt-1">Get the item you ordered or get your money back.</p>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="mt-8 border-t">
        <button
          onClick={() => setShowAbout(!showAbout)}
          className="w-full flex items-center justify-between py-4 text-left font-bold"
        >
          About this item
          <ChevronDown className={`w-5 h-5 transition ${showAbout ? 'rotate-180' : ''}`} />
        </button>
        {showAbout && (
          <div className="pb-4 text-sm text-ebay-gray whitespace-pre-wrap">{auction.description}</div>
        )}

        <button
          onClick={() => setShowShipping(!showShipping)}
          className="w-full flex items-center justify-between py-4 text-left font-bold border-t"
        >
          Shipping and payments
          <ChevronDown className={`w-5 h-5 transition ${showShipping ? 'rotate-180' : ''}`} />
        </button>
        {showShipping && (
          <div className="pb-4 text-sm text-ebay-gray">
            <p>Shipping cost: {auction.shippingCost > 0 ? formatPrice(auction.shippingCost) : 'Free'}</p>
            <p>Method: {auction.shippingMethod || 'Standard Shipping'}</p>
            <p>Location: {auction.location || 'Not specified'}</p>
          </div>
        )}
      </div>

      {/* Bid Confirmation Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Confirm your bid</h2>
              <button onClick={() => setShowBidModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <p className="text-sm font-medium">{auction.title}</p>
            <div className="flex items-center gap-2 text-sm text-ebay-gray mt-1">
              <CountdownTimer endTime={auction.endTime} />
              <span>· {bidCount} bids</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-ebay-gray">Your maximum bid</span>
                <span className="text-xl font-bold">US {formatPrice(parseFloat(maxBid) || parseFloat(bidAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ebay-gray">Current bid:</span>
                <span className="text-sm">US {formatPrice(auction.currentPrice)}</span>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-medium flex items-center gap-2">
                <span className="text-blue-600">ℹ️</span> How automatic bidding works
              </p>
              <p className="text-xs text-ebay-gray mt-1">
                We&apos;ll bid on your behalf up to your maximum bid. You only pay what&apos;s needed to be the highest bidder, not your maximum bid.
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-ebay-gray">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <span>By clicking Confirm bid, you commit to buy this item if you&apos;re the winning bidder.</span>
            </div>

            {bidError && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{bidError}</div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowBidModal(false)}
                className="flex-1 border border-gray-300 rounded-full py-3 font-medium text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceBid}
                disabled={bidding}
                className="flex-1 bg-ebay-blue text-white rounded-full py-3 font-medium text-sm hover:bg-ebay-blue-dark disabled:opacity-50"
              >
                {bidding ? 'Placing bid...' : 'Confirm bid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bid Success Modal */}
      {showBidSuccess && bidResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                Bid placed!
              </h2>
              <button onClick={() => setShowBidSuccess(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            {bidResult.isHighestBidder ? (
              <div className="bg-green-50 rounded-lg p-3 mb-4">
                <p className="text-green-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  You&apos;re currently the highest bidder
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Your maximum bid of US {formatPrice(parseFloat(maxBid))} has been placed.
                </p>
              </div>
            ) : (
              <div className="bg-orange-50 rounded-lg p-3 mb-4">
                <p className="text-orange-800 font-medium">You were outbid</p>
                <p className="text-sm text-orange-700 mt-1">{bidResult.message}</p>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <h3 className="font-medium">{auction.title}</h3>
              <div className="flex justify-between">
                <span className="text-ebay-gray">Your maximum bid:</span>
                <span className="font-medium">US {formatPrice(parseFloat(maxBid))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ebay-gray">Current bid:</span>
                <span>US {formatPrice(bidResult.currentPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ebay-gray">Time left:</span>
                <CountdownTimer endTime={auction.endTime} />
              </div>
              <div className="flex justify-between">
                <span className="text-ebay-gray">Auction ends:</span>
                <span>{formatDate(auction.endTime)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-ebay-gray">
              <h4 className="font-medium text-ebay-dark text-sm">What happens next?</h4>
              <div className="flex items-start gap-2">
                <span>🔔</span>
                <div>
                  <p className="font-medium text-ebay-dark">We&apos;ll notify you if you&apos;re outbid</p>
                  <p>You&apos;ll receive a notification if another bidder exceeds your maximum bid.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span>🏆</span>
                <div>
                  <p className="font-medium text-ebay-dark">If you win</p>
                  <p>You&apos;ll be notified and required to complete payment within 4 days after the auction ends.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span>✅</span>
                <div>
                  <p className="font-medium text-ebay-dark">Automatic bidding is active</p>
                  <p>We&apos;ll automatically bid on your behalf up to your maximum bid amount.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs flex items-start gap-2">
              <span className="text-blue-600">ℹ️</span>
              <div>
                <p className="font-medium text-ebay-dark">Remember</p>
                <p className="text-ebay-gray">Your bid is a binding contract. If you win, you&apos;re obligated to purchase this item.</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowBidSuccess(false); router.push('/search'); }}
                className="flex-1 border border-gray-300 rounded-full py-3 font-medium text-sm hover:bg-gray-50"
              >
                View other items
              </button>
              <button
                onClick={() => { setShowBidSuccess(false); router.push('/dashboard/bids'); }}
                className="flex-1 bg-ebay-blue text-white rounded-full py-3 font-medium text-sm hover:bg-ebay-blue-dark"
              >
                Go to My AuctionHub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
