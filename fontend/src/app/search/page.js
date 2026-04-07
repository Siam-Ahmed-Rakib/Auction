'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import AuctionCard from '@/components/AuctionCard';
import { List, Grid3X3, SlidersHorizontal } from 'lucide-react';

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sort') || 'bestMatch';

  const [auctions, setAuctions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(categoryParam);
  const [sort, setSort] = useState(sortParam);
  const [viewMode, setViewMode] = useState('grid');
  const [facets, setFacets] = useState({ categories: [] });
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function search() {
      setLoading(true);
      try {
        const data = await api.search({
          q, category, sort, page, limit: 20
        });
        setAuctions(data.auctions || []);
        setTotal(data.pagination?.total || 0);
        setFacets(data.facets || { categories: [] });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    search();
  }, [q, category, sort, page]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      {/* Related searches */}
      {q && (
        <div className="text-xs text-ebay-gray mb-4">
          Related: <span className="text-ebay-blue">{q}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">
          {total.toLocaleString()}+ results {q && <>for <span className="font-bold">{q}</span></>}
          {category && !q && <>in <span className="font-bold">{category}</span></>}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-56 flex-shrink-0">
          <div className="mb-6">
            <h3 className="font-bold text-sm mb-2">Category</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <button
                  onClick={() => setCategory('')}
                  className={`hover:underline ${!category ? 'font-bold text-ebay-dark' : 'text-ebay-blue'}`}
                >
                  All
                </button>
              </li>
              {facets.categories?.map(cat => (
                <li key={cat.category}>
                  <button
                    onClick={() => setCategory(cat.category)}
                    className={`hover:underline ${category === cat.category ? 'font-bold text-ebay-dark' : 'text-ebay-blue'}`}
                  >
                    {cat.category} ({cat._count})
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-sm mb-2">Condition</h3>
            <ul className="space-y-1 text-sm">
              {['New', 'Pre-Owned', 'Refurbished'].map(c => (
                <li key={c}><label className="flex items-center gap-2"><input type="checkbox" className="rounded" />{c}</label></li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div className="flex items-center gap-2">
              <button className="category-pill px-4 py-1.5 text-sm border rounded-full font-medium">All</button>
              <button className="category-pill px-4 py-1.5 text-sm border rounded-full">Auction</button>
              <button className="category-pill px-4 py-1.5 text-sm border rounded-full">Buy It Now</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-ebay-gray">Sort:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="border-0 text-sm font-medium bg-transparent cursor-pointer"
                >
                  <option value="bestMatch">Best Match</option>
                  <option value="endingSoon">Time: ending soonest</option>
                  <option value="newest">Time: newest listed</option>
                  <option value="priceLow">Price: lowest first</option>
                  <option value="priceHigh">Price: highest first</option>
                </select>
              </div>

              <div className="flex items-center border rounded">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 h-48 rounded-lg" />
                  <div className="mt-2 bg-gray-200 h-4 rounded w-3/4" />
                  <div className="mt-1 bg-gray-200 h-6 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl font-bold mb-2">No results found</p>
              <p className="text-ebay-gray">Try searching with different keywords or browse categories.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {auctions.map(auction => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {auctions.map(auction => (
                <Link key={auction.id} href={`/auctions/${auction.id}`} className="flex gap-4 p-4 border rounded-lg hover:shadow-md transition">
                  <div className="w-48 h-48 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                    {auction.images?.[0] ? (
                      <img src={auction.images[0]} alt={auction.title} className="max-h-full max-w-full object-contain" />
                    ) : <span className="text-4xl">📦</span>}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-ebay-dark hover:text-ebay-blue">{auction.title}</h3>
                    <p className="text-xs text-ebay-gray mt-1">{auction.condition}</p>
                    <p className="text-xl font-bold mt-2">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(auction.currentPrice)}</p>
                    <p className="text-xs text-ebay-gray">{auction._count?.bids || 0} bids</p>
                    {auction.shippingCost > 0 && (
                      <p className="text-xs text-ebay-gray mt-1">+${auction.shippingCost.toFixed(2)} shipping</p>
                    )}
                    <p className="text-xs text-ebay-gray mt-1">
                      {auction.seller?.username} {auction.seller?.positiveRate > 0 && `${auction.seller.positiveRate}% positive (${auction.seller.totalRatings})`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6"><div className="animate-pulse"><div className="bg-gray-200 h-8 rounded w-1/4 mb-6" /><div className="grid grid-cols-4 gap-4">{[...Array(8)].map((_,i)=><div key={i}><div className="bg-gray-200 h-48 rounded-lg" /><div className="mt-2 bg-gray-200 h-4 rounded w-3/4" /></div>)}</div></div></div>}>
      <SearchContent />
    </Suspense>
  );
}
