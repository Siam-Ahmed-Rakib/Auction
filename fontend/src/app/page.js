'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import AuctionCard from '@/components/AuctionCard';
import { useAuth } from '@/context/AuthContext';
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { CATEGORIES, CATEGORY_IMAGES } from '@/lib/utils';

export default function HomePage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [endingSoon, setEndingSoon] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [main, ending] = await Promise.all([
          api.getAuctions({ limit: 12, sort: 'newest' }),
          api.getAuctions({ limit: 8, sort: 'endTime', order: 'asc' })
        ]);
        setAuctions(main.auctions || []);
        setEndingSoon(ending.auctions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-yellow-100 via-yellow-50 to-yellow-100">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-5xl font-bold text-ebay-dark mb-3">
                Whatever you&apos;re into, it&apos;s here
              </h1>
              <p className="text-lg text-ebay-gray mb-6">
                Turn a wrench, get a tech upgrade, and find everything you love.
              </p>
              <Link href="/search" className="inline-block bg-ebay-dark text-white rounded-full px-8 py-3 text-sm font-medium hover:bg-gray-800 transition">
                Do your thing
              </Link>
            </div>
            <div className="hidden lg:flex items-center gap-6 mt-8 lg:mt-0">
              <Link href="/search?category=Motors" className="text-center group">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm group-hover:shadow-md transition">🚗</div>
                <span className="text-sm mt-2 inline-flex items-center">Motors <ChevronRight className="w-3 h-3" /></span>
              </Link>
              <Link href="/search?category=Electronics" className="text-center group">
                <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center text-4xl shadow-sm group-hover:shadow-md transition">💻</div>
                <span className="text-sm mt-2 inline-flex items-center">Electronics <ChevronRight className="w-3 h-3" /></span>
              </Link>
              <Link href="/search?category=Collectibles+and+Art" className="text-center group">
                <div className="w-24 h-24 bg-gradient-to-r from-pink-400 to-blue-400 rounded-full flex items-center justify-center text-4xl shadow-sm group-hover:shadow-md transition">🎨</div>
                <span className="text-sm mt-2 inline-flex items-center">Collectibles <ChevronRight className="w-3 h-3" /></span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Shopping made easy banner */}
      <section className="bg-ebay-dark text-white">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Shopping made easy</h2>
            <p className="text-sm text-gray-300">Enjoy reliability, secure deliveries and hassle-free returns.</p>
          </div>
          <Link href="/auth/register" className="bg-white text-ebay-dark rounded-full px-6 py-2 text-sm font-medium hover:bg-gray-100 transition">
            Start now
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-6">The future in your hands</h2>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {CATEGORIES.map(cat => (
            <Link key={cat.slug} href={`/search?category=${encodeURIComponent(cat.slug)}`} className="flex-shrink-0 text-center group">
              <div className="w-28 h-28 bg-gray-100 rounded-full flex items-center justify-center text-4xl group-hover:bg-gray-200 transition">
                {CATEGORY_IMAGES[cat.slug] || '📦'}
              </div>
              <span className="text-xs mt-2 block">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Ending Soon */}
      {endingSoon.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Ending Soon</h2>
            <Link href="/search?sort=endingSoon" className="text-ebay-blue text-sm hover:underline flex items-center gap-1">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {endingSoon.slice(0, 4).map(auction => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </section>
      )}

      {/* All Auctions */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Explore Auctions</h2>
          <Link href="/search" className="text-ebay-blue text-sm hover:underline flex items-center gap-1">
            See all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 h-52 rounded-lg" />
                <div className="mt-2 bg-gray-200 h-4 rounded w-3/4" />
                <div className="mt-1 bg-gray-200 h-6 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {auctions.map(auction => (
              <AuctionCard key={auction.id} auction={auction} compact />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      {!user && (
        <section className="bg-blue-50 py-12 mt-8">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Ready to start bidding?</h2>
            <p className="text-ebay-gray mb-6">Create an account to start buying and selling on AuctionHub.</p>
            <Link href="/auth/register" className="inline-block bg-ebay-blue text-white rounded-full px-8 py-3 font-medium hover:bg-ebay-blue-dark transition">
              Register now
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
