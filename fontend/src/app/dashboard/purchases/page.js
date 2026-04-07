'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { Package, Truck, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

export default function PurchasesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadOrders();
  }, [user]);

  async function loadOrders() {
    try {
      const data = await api.getBuyerOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelivery(orderId) {
    try {
      await api.confirmDelivery(orderId);
      loadOrders();
    } catch (err) {
      alert(err.message);
    }
  }

  if (authLoading || !user) return null;

  const statusBadge = (status) => {
    const map = {
      PENDING_PAYMENT: { bg: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" />, label: 'Awaiting Payment' },
      PAID: { bg: 'bg-blue-100 text-blue-800', icon: <Package className="w-3 h-3" />, label: 'Paid' },
      SHIPPED: { bg: 'bg-purple-100 text-purple-800', icon: <Truck className="w-3 h-3" />, label: 'Shipped' },
      DELIVERED: { bg: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Delivered' },
      COMPLETED: { bg: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Completed' },
      DISPUTED: { bg: 'bg-red-100 text-red-800', icon: <Clock className="w-3 h-3" />, label: 'Disputed' },
      CANCELLED: { bg: 'bg-gray-100 text-gray-600', icon: <Clock className="w-3 h-3" />, label: 'Cancelled' },
    };
    const s = map[status] || map.PENDING_PAYMENT;
    return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.bg}`}>{s.icon} {s.label}</span>;
  };

  const filtered = tab === 'all' ? orders : orders.filter(o => {
    if (tab === 'active') return ['PENDING_PAYMENT', 'PAID', 'SHIPPED'].includes(o.status);
    if (tab === 'completed') return ['DELIVERED', 'COMPLETED'].includes(o.status);
    return true;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-56 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4">My AuctionHub</h2>
          <nav className="space-y-1 text-sm">
            <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Summary</Link>
            <Link href="/dashboard/bids" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Bids & offers</Link>
            <Link href="/dashboard/watchlist" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Watchlist</Link>
            <Link href="/dashboard/purchases" className="block px-3 py-2 rounded-lg bg-gray-100 font-bold">Purchases</Link>
            <Link href="/dashboard/selling" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Selling</Link>
          </nav>
        </aside>

        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">Purchases</h1>
          <p className="text-sm text-ebay-gray mb-6">Track your orders and delivery status</p>

          <div className="flex gap-2 mb-6">
            {['all', 'active', 'completed'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`capitalize px-4 py-2 rounded-full text-sm font-medium border transition ${
                  tab === t ? 'bg-ebay-dark text-white border-ebay-dark' : 'bg-white text-ebay-dark border-gray-300 hover:border-ebay-dark'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

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
              <p className="text-lg font-bold mb-2">No purchases yet</p>
              <p className="text-sm text-ebay-gray mb-4">Win an auction to see your purchases here.</p>
              <Link href="/search" className="inline-block bg-ebay-blue text-white rounded-full px-6 py-2 text-sm font-medium">
                Find items
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(order => (
                <div key={order.id} className="border rounded-xl p-4 hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-ebay-gray">Order #{order.orderNumber || order.id.slice(0, 8)}</p>
                      {statusBadge(order.status)}
                    </div>
                    <p className="text-xs text-ebay-gray">{formatDate(order.createdAt)}</p>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {order.auction?.images?.[0] ? (
                        <img src={order.auction.images[0]} alt="" className="max-h-full max-w-full object-contain" />
                      ) : <span className="text-2xl">📦</span>}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{order.auction?.title}</p>
                      <p className="text-xs text-ebay-gray mt-0.5">Seller: {order.seller?.username}</p>
                      <p className="font-bold mt-1">{formatPrice(order.totalAmount)}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {order.status === 'PENDING_PAYMENT' && (
                        <Link
                          href={`/checkout/${order.auctionId}`}
                          className="bg-ebay-blue text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-ebay-blue-dark"
                        >
                          Pay Now
                        </Link>
                      )}
                      {order.status === 'SHIPPED' && (
                        <button
                          onClick={() => confirmDelivery(order.id)}
                          className="bg-green-600 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-green-700"
                        >
                          Confirm Delivery
                        </button>
                      )}
                      {order.status === 'DELIVERED' && !order.feedback && (
                        <Link
                          href={`/dashboard/feedback/${order.id}`}
                          className="border border-ebay-blue text-ebay-blue rounded-full px-4 py-1.5 text-sm font-medium hover:bg-blue-50"
                        >
                          Leave Feedback
                        </Link>
                      )}
                      <Link href={`/auctions/${order.auctionId}`} className="text-xs text-ebay-blue hover:underline flex items-center gap-0.5">
                        View item <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {order.trackingNumber && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-2.5 text-xs flex items-center gap-2">
                      <Truck className="w-4 h-4 text-ebay-gray" />
                      <span>Tracking: <span className="font-mono">{order.trackingNumber}</span></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
