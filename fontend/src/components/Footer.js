import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-ebay-light border-t border-gray-200 mt-12">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h3 className="font-bold mb-3">Buy</h3>
            <ul className="space-y-2 text-ebay-gray">
              <li><Link href="/auth/register" className="hover:underline">Registration</Link></li>
              <li><Link href="/search" className="hover:underline">Bidding & buying help</Link></li>
              <li><Link href="/" className="hover:underline">Stores</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-3">Sell</h3>
            <ul className="space-y-2 text-ebay-gray">
              <li><Link href="/auctions/create" className="hover:underline">Start selling</Link></li>
              <li><Link href="/auctions/create" className="hover:underline">Learn to sell</Link></li>
              <li><Link href="/dashboard/selling" className="hover:underline">Seller hub</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-3">About AuctionHub</h3>
            <ul className="space-y-2 text-ebay-gray">
              <li><Link href="/" className="hover:underline">Company info</Link></li>
              <li><Link href="/" className="hover:underline">Policies</Link></li>
              <li><Link href="/" className="hover:underline">Community</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-3">Help & Contact</h3>
            <ul className="space-y-2 text-ebay-gray">
              <li><Link href="/" className="hover:underline">Resolution Center</Link></li>
              <li><Link href="/" className="hover:underline">Seller Information Center</Link></li>
              <li><Link href="/" className="hover:underline">Contact us</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-8 pt-6 text-center text-xs text-ebay-gray">
          <p>Copyright © 2026 AuctionHub Inc. All Rights Reserved.</p>
          <p className="mt-1">
            <Link href="/" className="hover:underline">User Agreement</Link> |{' '}
            <Link href="/" className="hover:underline">Privacy</Link> |{' '}
            <Link href="/" className="hover:underline">Cookies</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
