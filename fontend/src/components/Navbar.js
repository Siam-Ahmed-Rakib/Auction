'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Search, Bell, ShoppingCart, ChevronDown, User, Heart, Package, Menu, X, Gavel } from 'lucide-react';

const CATEGORIES = [
  'Electronics', 'Fashion', 'Motors', 'Collectibles and Art',
  'Sports', 'Health & Beauty', 'Industrial Equipment', 'Home & Garden',
  'Deals'
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const socket = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [outbidToast, setOutbidToast] = useState(null);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial unread count
  useEffect(() => {
    if (user) {
      api.getNotifications({ unreadOnly: 'true' })
        .then(data => setUnreadCount(data.unreadCount || 0))
        .catch(() => {});
    }
  }, [user]);

  // Real-time notification updates via socket
  useEffect(() => {
    if (socket && user) {
      const handleNotification = () => {
        setUnreadCount(prev => prev + 1);
      };
      const handleOutbid = (data) => {
        setUnreadCount(prev => prev + 1);
        setOutbidToast({
          auctionId: data.auctionId,
          title: data.title,
          currentPrice: data.currentPrice,
        });
        setTimeout(() => setOutbidToast(null), 8000);
      };
      socket.on('notification', handleNotification);
      socket.on('outbid', handleOutbid);
      return () => {
        socket.off('notification', handleNotification);
        socket.off('outbid', handleOutbid);
      };
    }
  }, [socket, user]);

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
                  My eBay <ChevronDown className="inline w-3 h-3" />
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
            <span className="text-2xl font-bold italic">
              <span className="text-ebay-red">e</span>
              <span className="text-ebay-blue">b</span>
              <span className="text-ebay-yellow">a</span>
              <span className="text-ebay-green">y</span>
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
            <div className="relative hidden lg:block" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 text-sm hover:text-ebay-blue"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-ebay-blue text-white flex items-center justify-center text-sm font-semibold">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className="max-w-[100px] truncate font-medium">{user.name?.split(' ')[0]}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-56 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
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
              <div className="flex items-center gap-3 py-2 border-b border-gray-100 mb-2 pb-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ebay-blue text-white flex items-center justify-center font-semibold">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
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

      {/* Outbid Toast Notification */}
      {outbidToast && (
        <div className="fixed top-4 right-4 z-[100] bg-white border border-orange-200 rounded-xl shadow-xl p-4 max-w-sm animate-in slide-in-from-right">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Gavel className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-orange-800">You&apos;ve been outbid!</p>
              <p className="text-sm text-gray-700 mt-0.5 truncate">{outbidToast.title}</p>
              {outbidToast.currentPrice && (
                <p className="text-xs text-ebay-gray mt-0.5">Current price: {formatPrice(outbidToast.currentPrice)}</p>
              )}
              <Link
                href={`/auctions/${outbidToast.auctionId}`}
                onClick={() => setOutbidToast(null)}
                className="inline-block text-xs text-ebay-blue hover:underline font-medium mt-2"
              >
                View auction &rarr;
              </Link>
            </div>
            <button onClick={() => setOutbidToast(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
        </div>
      )}
    </header>
  );
}
