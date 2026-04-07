'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Search, Bell, ShoppingCart, ChevronDown, User, Heart, Package, Menu, X } from 'lucide-react';

const CATEGORIES = [
  'Electronics', 'Fashion', 'Motors', 'Collectibles and Art',
  'Sports', 'Health & Beauty', 'Industrial Equipment', 'Home & Garden',
  'Deals'
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      api.getNotifications({ unreadOnly: 'true' })
        .then(data => setUnreadCount(data.unreadCount))
        .catch(() => {});
    }
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="border-b border-gray-200">
      {/* Top bar */}
      <div className="bg-white px-4 lg:px-8 py-2">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between text-xs text-ebay-gray">
          <div className="flex items-center gap-4">
            {user ? (
              <span>Hi <Link href="/dashboard" className="text-ebay-blue font-semibold hover:underline">{user.name?.split(' ')[0]}</Link>!</span>
            ) : (
              <span>Hi! <Link href="/auth/login" className="text-ebay-blue hover:underline">Sign in</Link> or <Link href="/auth/register" className="text-ebay-blue hover:underline">register</Link></span>
            )}
            <Link href="/deals" className="hover:underline hidden sm:inline">Daily Deals</Link>
            <Link href="/help" className="hover:underline hidden sm:inline">Help & Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auctions/create" className="hover:underline">Sell</Link>
            {user && (
              <>
                <Link href="/dashboard/watchlist" className="hover:underline hidden sm:inline">
                  Watchlist <ChevronDown className="inline w-3 h-3" />
                </Link>
                <Link href="/dashboard" className="hover:underline hidden sm:inline">
                  My AuctionHub <ChevronDown className="inline w-3 h-3" />
                </Link>
                <button onClick={() => router.push('/notifications')} className="relative">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-ebay-red text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="bg-white px-4 lg:px-8 py-2">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          <Link href="/" className="flex-shrink-0">
            <span className="text-2xl font-bold">
              <span className="text-ebay-red">A</span>
              <span className="text-ebay-blue">u</span>
              <span className="text-ebay-yellow">c</span>
              <span className="text-ebay-green">t</span>
              <span className="text-ebay-red">i</span>
              <span className="text-ebay-blue">o</span>
              <span className="text-ebay-yellow">n</span>
              <span className="text-ebay-green">H</span>
              <span className="text-ebay-red">u</span>
              <span className="text-ebay-blue">b</span>
            </span>
          </Link>

          <button
            className="hidden max-lg:block p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="text-ebay-dark font-medium">Shop by category</span>
            <ChevronDown className="w-4 h-4" />
          </div>

          <form onSubmit={handleSearch} className="flex-1 flex max-lg:hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for anything"
              className="flex-1 border border-gray-300 rounded-l-full px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="bg-ebay-blue text-white px-8 py-2.5 rounded-r-full hover:bg-ebay-blue-dark transition text-sm font-medium"
            >
              Search
            </button>
          </form>

          {user && (
            <div className="relative hidden lg:block">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1 text-sm hover:text-ebay-blue"
              >
                <User className="w-5 h-5" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-48 z-50">
                  <Link href="/dashboard" className="block px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>
                    Dashboard
                  </Link>
                  <Link href="/dashboard/bids" className="block px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>
                    Bids & Offers
                  </Link>
                  <Link href="/dashboard/purchases" className="block px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>
                    Purchases
                  </Link>
                  <Link href="/dashboard/selling" className="block px-4 py-2 hover:bg-gray-50 text-sm" onClick={() => setShowUserMenu(false)}>
                    Selling
                  </Link>
                  <hr className="my-1" />
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); router.push('/'); }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile search */}
      <div className="lg:hidden px-4 pb-2">
        <form onSubmit={handleSearch} className="flex">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for anything"
            className="flex-1 border border-gray-300 rounded-l-full px-4 py-2 text-sm"
          />
          <button type="submit" className="bg-ebay-blue text-white px-6 py-2 rounded-r-full">
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Category nav */}
      <nav className="bg-white border-t border-gray-100 px-4 lg:px-8 overflow-x-auto">
        <div className="max-w-[1400px] mx-auto flex items-center gap-6 py-2 text-sm whitespace-nowrap">
          {CATEGORIES.map(cat => (
            <Link
              key={cat}
              href={`/search?category=${encodeURIComponent(cat)}`}
              className="text-ebay-dark hover:text-ebay-blue transition"
            >
              {cat}
            </Link>
          ))}
          <Link href="/auctions/create" className="text-ebay-dark hover:text-ebay-blue transition">Sell</Link>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t px-4 py-4">
          {user ? (
            <div className="space-y-2">
              <Link href="/dashboard" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
              <Link href="/dashboard/bids" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Bids & Offers</Link>
              <Link href="/dashboard/selling" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Selling</Link>
              <Link href="/auctions/create" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Create Listing</Link>
              <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="block py-2 text-red-600">Sign out</button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/auth/login" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
              <Link href="/auth/register" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Register</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
