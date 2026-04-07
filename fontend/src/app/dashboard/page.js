'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Package, Tag, Heart, ShoppingBag, Award, Settings, Star } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      api.getStats().then(setStats).catch(console.error);
    }
  }, [user]);

  if (authLoading || !user) return null;

  const sideLinks = [
    { href: '/dashboard', label: 'Summary', icon: Package },
    { href: '/dashboard/bids', label: 'Bids & offers', icon: Tag, active: false },
    { href: '/dashboard/watchlist', label: 'Watchlist', icon: Heart },
    { href: '/dashboard/purchases', label: 'Purchases', icon: ShoppingBag },
    { href: '/dashboard/selling', label: 'Selling', icon: Award },
    { href: '/dashboard/settings', label: 'Preferences', icon: Settings },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-56 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">My AuctionHub</h2>
          <nav className="space-y-1">
            {sideLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 text-ebay-dark"
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-6">Welcome, {user.name}!</h1>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-ebay-gray">Active Bids</p>
                <p className="text-2xl font-bold text-ebay-blue">{stats.activeBids}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-ebay-gray">Won Items</p>
                <p className="text-2xl font-bold text-green-700">{stats.wonItems}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm text-ebay-gray">Lost Bids</p>
                <p className="text-2xl font-bold text-ebay-red">{stats.lostBids}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-ebay-gray">Total Spent</p>
                <p className="text-2xl font-bold text-purple-700">{formatPrice(stats.totalSpent)}</p>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Link href="/dashboard/bids" className="border rounded-xl p-5 hover:shadow-md transition">
              <Tag className="w-8 h-8 text-ebay-blue mb-2" />
              <h3 className="font-bold">Bids & Offers</h3>
              <p className="text-sm text-ebay-gray mt-1">Track your active bids, won items, and lost auctions.</p>
            </Link>
            <Link href="/auctions/create" className="border rounded-xl p-5 hover:shadow-md transition">
              <Award className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="font-bold">Sell an Item</h3>
              <p className="text-sm text-ebay-gray mt-1">Create a new auction listing and start selling.</p>
            </Link>
            <Link href="/dashboard/purchases" className="border rounded-xl p-5 hover:shadow-md transition">
              <ShoppingBag className="w-8 h-8 text-purple-600 mb-2" />
              <h3 className="font-bold">Purchases</h3>
              <p className="text-sm text-ebay-gray mt-1">View your order history and manage deliveries.</p>
            </Link>
          </div>

          {/* Seller stats */}
          {stats && (stats.activeListings > 0 || stats.soldItems > 0) && (
            <div className="border rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">Seller Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-ebay-gray">Active Listings</p>
                  <p className="text-xl font-bold">{stats.activeListings}</p>
                </div>
                <div>
                  <p className="text-sm text-ebay-gray">Sold Items</p>
                  <p className="text-xl font-bold">{stats.soldItems}</p>
                </div>
                <div>
                  <p className="text-sm text-ebay-gray">Total Earned</p>
                  <p className="text-xl font-bold text-green-700">{formatPrice(stats.totalEarned)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rating */}
          {user.totalRatings > 0 && (
            <div className="mt-6 border rounded-xl p-6">
              <h3 className="font-bold text-lg mb-2">Your Reputation</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-5 h-5 ${s <= Math.round(user.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                  ))}
                </div>
                <span className="text-lg font-bold">{user.rating}</span>
                <span className="text-sm text-ebay-gray">({user.totalRatings} ratings · {user.positiveRate}% positive)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
