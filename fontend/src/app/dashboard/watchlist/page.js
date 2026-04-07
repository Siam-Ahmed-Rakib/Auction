'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import AuctionCard from '@/components/AuctionCard';
import { Heart, Trash2 } from 'lucide-react';

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadWatchlist();
  }, [user]);

  async function loadWatchlist() {
    try {
      const data = await api.getWatchlist();
      setWatchlist(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function removeFromWatchlist(auctionId) {
    try {
      await api.toggleWatchlist(auctionId);
      setWatchlist(prev => prev.filter(item => item.auctionId !== auctionId && item.id !== auctionId));
    } catch (err) {
      console.error(err);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-56 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">My AuctionHub</h2>
          <nav className="space-y-1 text-sm">
            <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Summary</Link>
            <Link href="/dashboard/bids" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Bids & offers</Link>
            <Link href="/dashboard/watchlist" className="block px-3 py-2 rounded-lg bg-gray-100 font-bold">Watchlist</Link>
            <Link href="/dashboard/purchases" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Purchases</Link>
            <Link href="/dashboard/selling" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Selling</Link>
          </nav>
        </aside>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-ebay-red" />
            <h1 className="text-2xl font-bold">Watchlist</h1>
          </div>
          <p className="text-sm text-ebay-gray mb-6">{watchlist.length} items you&apos;re watching</p>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="animate-pulse border rounded-xl p-3">
                  <div className="bg-gray-200 h-40 rounded-lg" />
                  <div className="mt-2 space-y-2">
                    <div className="bg-gray-200 h-4 rounded w-3/4" />
                    <div className="bg-gray-200 h-4 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : watchlist.length === 0 ? (
            <div className="text-center py-16 border rounded-xl">
              <Heart className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-bold mb-2">Your watchlist is empty</p>
              <p className="text-sm text-ebay-gray mb-4">Add items you want to track by clicking the heart icon on any auction.</p>
              <Link href="/search" className="inline-block bg-ebay-blue text-white rounded-full px-6 py-2 text-sm font-medium">
                Find items
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {watchlist.map(item => {
                const auction = item.auction || item;
                return (
                  <div key={auction.id} className="relative group">
                    <AuctionCard auction={auction} />
                    <button
                      onClick={() => removeFromWatchlist(item.auctionId || auction.id)}
                      className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition hover:bg-red-50"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
