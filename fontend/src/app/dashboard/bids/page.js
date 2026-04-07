'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import { ArrowUp, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

export default function BidsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, won: 0, lost: 0 });

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadBids();
  }, [user, tab]);

  async function loadBids() {
    setLoading(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const data = await api.getMyBids(statusParam);
      setBids(data);

      // Calculate stats
      if (tab === 'all') {
        const all = data;
        setStats({
          active: all.filter(b => b.auction.status === 'ACTIVE').length,
          won: all.filter(b => b.bidStatus === 'won').length,
          lost: all.filter(b => b.bidStatus === 'lost').length,
          totalSpent: all.filter(b => b.bidStatus === 'won').reduce((sum, b) => sum + b.auction.currentPrice, 0)
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) return null;

  const tabs = [
    { id: 'all', label: 'All Bids' },
    { id: 'active', label: 'Active' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' },
  ];

  const getStatusBadge = (bidStatus) => {
    switch (bidStatus) {
      case 'winning': return <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Winning</span>;
      case 'won': return <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Won</span>;
      case 'outbid': return <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Outbid</span>;
      case 'lost': return <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Outbid</span>;
      default: return <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Loading</span>;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-56 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">My AuctionHub</h2>
          <nav className="space-y-1 text-sm">
            <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Summary</Link>
            <Link href="/dashboard/bids" className="block px-3 py-2 rounded-lg bg-gray-100 font-bold">Bids & offers</Link>
            <Link href="/dashboard/watchlist" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Watchlist</Link>
            <Link href="/dashboard/purchases" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Purchases</Link>
            <Link href="/dashboard/selling" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Selling</Link>
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Bids & Offers</h1>
            <Link href="/search" className="text-xs text-ebay-blue hover:underline">Bidding help</Link>
          </div>
          <p className="text-sm text-ebay-gray mb-6">Track your active bids, won items, and lost auctions</p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <p className="text-xs text-ebay-gray">Active Bids</p>
              <p className="text-2xl font-bold text-ebay-blue">{stats.active}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-ebay-gray">Won Items</p>
              <p className="text-2xl font-bold text-green-700">{stats.won}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-ebay-gray">Lost Bids</p>
              <p className="text-2xl font-bold text-ebay-red">{stats.lost}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-ebay-gray">Total Spent</p>
              <p className="text-2xl font-bold">{formatPrice(stats.totalSpent || 0)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                  tab === t.id ? 'bg-ebay-dark text-white border-ebay-dark' : 'bg-white text-ebay-dark border-gray-300 hover:border-ebay-dark'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Bid list */}
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse border rounded-xl p-4 flex gap-4">
                  <div className="w-32 h-32 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-gray-200 h-5 rounded w-2/3" />
                    <div className="bg-gray-200 h-4 rounded w-1/3" />
                    <div className="bg-gray-200 h-8 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-16 border rounded-xl">
              <p className="text-lg font-bold mb-2">No bids yet</p>
              <p className="text-sm text-ebay-gray mb-4">Start browsing auctions to place your first bid.</p>
              <Link href="/search" className="inline-block bg-ebay-blue text-white rounded-full px-6 py-2 text-sm font-medium">
                Find items
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bids.map(item => (
                <div key={item.auction.id} className="border rounded-xl p-4 hover:shadow-md transition">
                  <div className="flex gap-4">
                    <Link href={`/auctions/${item.auction.id}`} className="flex-shrink-0">
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                        {item.auction.images?.[0] ? (
                          <img src={item.auction.images[0]} alt="" className="max-h-full max-w-full object-contain" />
                        ) : <span className="text-3xl">📦</span>}
                      </div>
                    </Link>

                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link href={`/auctions/${item.auction.id}`} className="font-medium hover:text-ebay-blue">
                            {item.auction.title}
                          </Link>
                          <p className="text-xs text-ebay-gray mt-0.5">
                            Sold by: {item.auction.seller?.username}
                          </p>
                        </div>
                        {getStatusBadge(item.bidStatus)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-xs text-ebay-gray">Your Max Bid</p>
                          <p className="font-bold text-ebay-blue">{formatPrice(item.userMaxBid || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ebay-gray">Winning Bid</p>
                          <p className="font-bold">{formatPrice(item.highestBid || item.auction.currentPrice)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ebay-gray">{item.auction.status === 'ACTIVE' ? 'Time Left' : 'Ended'}</p>
                          {item.auction.status === 'ACTIVE' ? (
                            <CountdownTimer endTime={item.auction.endTime} />
                          ) : (
                            <p className="text-sm">{formatDate(item.auction.endTime)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-ebay-gray">Bids</p>
                          <p className="text-sm">{item.bidCount}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4">
                        {item.bidStatus === 'won' && (
                          <Link href={`/checkout/${item.auction.id}`} className="bg-ebay-blue text-white rounded-full px-5 py-1.5 text-sm font-medium hover:bg-ebay-blue-dark">
                            Pay Now
                          </Link>
                        )}
                        {(item.bidStatus === 'outbid' || item.bidStatus === 'winning') && item.auction.status === 'ACTIVE' && (
                          <Link href={`/auctions/${item.auction.id}`} className="bg-ebay-blue text-white rounded-full px-5 py-1.5 text-sm font-medium hover:bg-ebay-blue-dark">
                            {item.bidStatus === 'outbid' ? 'Increase Bid' : 'View Item'}
                          </Link>
                        )}
                        {item.bidStatus === 'lost' && (
                          <Link href="/search" className="border border-ebay-blue text-ebay-blue rounded-full px-5 py-1.5 text-sm font-medium hover:bg-blue-50">
                            Find Similar Items
                          </Link>
                        )}
                      </div>

                      {/* Winning alert */}
                      {item.bidStatus === 'winning' && (
                        <div className="mt-3 bg-green-50 rounded-lg p-2.5 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <div>
                            <span className="font-medium text-green-800">You&apos;re currently the highest bidder!</span>
                            <span className="text-green-700 ml-1">Keep an eye on this auction - other bidders may place last-minute bids</span>
                          </div>
                        </div>
                      )}

                      {item.bidStatus === 'outbid' && (
                        <div className="mt-3 bg-orange-50 rounded-lg p-2.5 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <span className="text-orange-800">You were outbid by {item.auction.seller?.username || 'another bidder'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bidding tips */}
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <h3 className="font-bold text-sm flex items-center gap-2">💡 Bidding Tips</h3>
            <ul className="mt-2 space-y-1 text-xs text-ebay-gray list-disc pl-5">
              <li>Set your maximum bid to the highest amount you&apos;re willing to pay</li>
              <li>AuctionHub will automatically bid on your behalf up to your maximum amount</li>
              <li>Watch items ending soon - many auctions see last-minute bidding activity</li>
              <li>Check the seller&apos;s feedback and shipping costs before bidding</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
