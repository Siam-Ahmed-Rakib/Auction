'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import { Package, DollarSign, BarChart3, Truck, Plus, Eye, ChevronRight } from 'lucide-react';

export default function SellingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [auctions, setAuctions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    try {
      const [auctData, orderData] = await Promise.all([
        api.getSellerAuctions(),
        api.getSellerOrders(),
      ]);
      setAuctions(auctData);
      setOrders(orderData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function shipOrder(orderId, trackingNumber) {
    try {
      await api.shipOrder(orderId, trackingNumber);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  if (authLoading || !user) return null;

  const activeAuctions = auctions.filter(a => a.status === 'ACTIVE');
  const soldAuctions = auctions.filter(a => a.status === 'SOLD');
  const endedAuctions = auctions.filter(a => ['ENDED', 'RESERVE_NOT_MET', 'CANCELLED'].includes(a.status));
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const awaitingShipment = orders.filter(o => o.status === 'PAID');

  const filtered = tab === 'active' ? activeAuctions : tab === 'sold' ? soldAuctions : endedAuctions;

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-56 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">My AuctionHub</h2>
          <nav className="space-y-1 text-sm">
            <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Summary</Link>
            <Link href="/dashboard/bids" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Bids & offers</Link>
            <Link href="/dashboard/watchlist" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Watchlist</Link>
            <Link href="/dashboard/purchases" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Purchases</Link>
            <Link href="/dashboard/selling" className="block px-3 py-2 rounded-lg bg-gray-100 font-bold">Selling</Link>
          </nav>
        </aside>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Selling</h1>
              <p className="text-sm text-ebay-gray">Manage your listings and ship sold items</p>
            </div>
            <Link href="/auctions/create" className="bg-ebay-blue text-white rounded-full px-5 py-2 text-sm font-medium flex items-center gap-2 hover:bg-ebay-blue-dark">
              <Plus className="w-4 h-4" /> Create Listing
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="border rounded-xl p-4 text-center">
              <BarChart3 className="w-5 h-5 mx-auto text-ebay-blue mb-1" />
              <p className="text-2xl font-bold">{activeAuctions.length}</p>
              <p className="text-xs text-ebay-gray">Active</p>
            </div>
            <div className="border rounded-xl p-4 text-center">
              <Package className="w-5 h-5 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold">{soldAuctions.length}</p>
              <p className="text-xs text-ebay-gray">Sold</p>
            </div>
            <div className="border rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 mx-auto text-ebay-green mb-1" />
              <p className="text-2xl font-bold">{formatPrice(totalRevenue)}</p>
              <p className="text-xs text-ebay-gray">Total Revenue</p>
            </div>
            <div className="border rounded-xl p-4 text-center">
              <Truck className="w-5 h-5 mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-bold">{awaitingShipment.length}</p>
              <p className="text-xs text-ebay-gray">To Ship</p>
            </div>
          </div>

          {/* Awaiting shipment */}
          {awaitingShipment.length > 0 && (
            <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-orange-600" /> Items awaiting shipment ({awaitingShipment.length})
              </h3>
              <div className="space-y-3">
                {awaitingShipment.map(order => (
                  <div key={order.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        {order.auction?.images?.[0] ? (
                          <img src={order.auction.images[0]} alt="" className="max-h-full max-w-full object-contain" />
                        ) : <span>📦</span>}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order.auction?.title}</p>
                        <p className="text-xs text-ebay-gray">Buyer: {order.buyer?.username} • {formatPrice(order.totalAmount)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const tracking = prompt('Enter tracking number:');
                        if (tracking) shipOrder(order.id, tracking);
                      }}
                      className="bg-ebay-blue text-white rounded-full px-4 py-1.5 text-xs font-medium hover:bg-ebay-blue-dark"
                    >
                      Mark Shipped
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'active', label: `Active (${activeAuctions.length})` },
              { id: 'sold', label: `Sold (${soldAuctions.length})` },
              { id: 'ended', label: `Ended (${endedAuctions.length})` },
            ].map(t => (
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

          {/* Auction list */}
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse border rounded-xl p-4 flex gap-4">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-gray-200 h-5 rounded w-2/3" />
                    <div className="bg-gray-200 h-4 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border rounded-xl">
              <p className="text-lg font-bold mb-2">No {tab} listings</p>
              <p className="text-sm text-ebay-gray mb-4">
                {tab === 'active' ? 'Create a listing to start selling.' : `You have no ${tab} auctions.`}
              </p>
              {tab === 'active' && (
                <Link href="/auctions/create" className="inline-block bg-ebay-blue text-white rounded-full px-6 py-2 text-sm font-medium">
                  Create Listing
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(auction => (
                <div key={auction.id} className="border rounded-xl p-4 hover:shadow-md transition">
                  <div className="flex gap-4">
                    <Link href={`/auctions/${auction.id}`} className="flex-shrink-0">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        {auction.images?.[0] ? (
                          <img src={auction.images[0]} alt="" className="max-h-full max-w-full object-contain" />
                        ) : <span className="text-2xl">📦</span>}
                      </div>
                    </Link>
                    <div className="flex-1">
                      <Link href={`/auctions/${auction.id}`} className="font-medium hover:text-ebay-blue">
                        {auction.title}
                      </Link>
                      <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-ebay-gray">Current Price</p>
                          <p className="font-bold">{formatPrice(auction.currentPrice)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ebay-gray">Bids</p>
                          <p>{auction._count?.bids || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ebay-gray">{auction.status === 'ACTIVE' ? 'Time Left' : 'Status'}</p>
                          {auction.status === 'ACTIVE' ? (
                            <CountdownTimer endTime={auction.endTime} />
                          ) : (
                            <span className="capitalize text-sm">{auction.status.toLowerCase().replace('_', ' ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Link href={`/auctions/${auction.id}`} className="text-xs text-ebay-blue hover:underline flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> View <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
