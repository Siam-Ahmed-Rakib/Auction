'use client';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import CountdownTimer from './CountdownTimer';
import { Heart, MapPin } from 'lucide-react';

export default function AuctionCard({ auction, compact = false }) {
  const bidCount = auction._count?.bids || 0;

  return (
    <div className={`auction-card rounded-lg border border-gray-200 overflow-hidden transition ${compact ? '' : 'hover:shadow-md'}`}>
      <Link href={`/auctions/${auction.id}`}>
        <div className={`relative bg-gray-100 ${compact ? 'h-40' : 'h-52'} flex items-center justify-center`}>
          {auction.images?.[0] ? (
            <img
              src={auction.images[0]}
              alt={auction.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-4xl">📦</div>
          )}
          {auction.condition === 'New' && (
            <span className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">New</span>
          )}
        </div>

        <div className="p-3">
          <h3 className="text-sm font-medium text-ebay-dark line-clamp-2 min-h-[2.5rem]">
            {auction.title}
          </h3>

          <div className="mt-2">
            <span className="text-lg font-bold text-ebay-dark">
              {formatPrice(auction.currentPrice)}
            </span>
            {auction.startPrice !== auction.currentPrice && (
              <span className="text-xs text-gray-400 line-through ml-2">
                {formatPrice(auction.startPrice)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-1.5 text-xs text-ebay-gray">
            <span>{bidCount} bid{bidCount !== 1 ? 's' : ''}</span>
            {auction.status === 'ACTIVE' && (
              <CountdownTimer endTime={auction.endTime} />
            )}
          </div>

          {auction.shippingCost > 0 ? (
            <p className="text-xs text-ebay-gray mt-1">+{formatPrice(auction.shippingCost)} shipping</p>
          ) : (
            <p className="text-xs text-green-700 font-medium mt-1">Free shipping</p>
          )}

          {auction.seller && (
            <p className="text-xs text-ebay-gray mt-1">
              {auction.seller.username} {auction.seller.positiveRate > 0 && (
                <span className="text-green-700">{auction.seller.positiveRate}% positive</span>
              )}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}
