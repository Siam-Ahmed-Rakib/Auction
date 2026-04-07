'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { CheckCircle, Package, Truck, MapPin, CreditCard, ShoppingBag } from 'lucide-react';

export default function PaymentSuccessPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) loadOrder();
  }, [user, id]);

  async function loadOrder() {
    try {
      const orders = await api.getBuyerOrders();
      const found = orders.find(o => o.id === id);
      if (found) setOrder(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="animate-pulse text-center space-y-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
          <div className="bg-gray-200 h-8 rounded w-1/2 mx-auto" />
          <div className="bg-gray-200 h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <p className="text-lg mb-4">Order not found</p>
        <Link href="/dashboard" className="text-ebay-blue underline">Go to Dashboard</Link>
      </div>
    );
  }

  const auction = order.auction;
  const payment = order.payment;
  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Payment confirmed!</h1>
        <p className="text-ebay-gray text-sm">Thank you for your purchase, {user?.name || user?.username}.</p>
      </div>

      {/* Order details card */}
      <div className="border rounded-xl overflow-hidden">
        {/* Order header */}
        <div className="bg-gray-50 px-5 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-xs text-ebay-gray">Order number</p>
            <p className="font-bold text-sm">{order.orderNumber || order.id.slice(0, 12).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ebay-gray">Order date</p>
            <p className="text-sm">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Item */}
        <div className="p-5 border-b">
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              {auction?.images?.[0] ? (
                <img src={auction.images[0]} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
              ) : <span className="text-3xl">📦</span>}
            </div>
            <div>
              <p className="font-medium">{auction?.title}</p>
              <p className="text-xs text-ebay-gray mt-1">Condition: {auction?.condition}</p>
              <p className="text-xs text-ebay-gray">Seller: {auction?.seller?.username}</p>
              <p className="font-bold text-lg mt-2">{formatPrice(auction?.currentPrice)}</p>
            </div>
          </div>
        </div>

        {/* Shipping info */}
        <div className="p-5 border-b grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4" /> Shipping to
            </h3>
            <div className="text-sm text-ebay-gray space-y-0.5">
              <p>{order.shippingAddress?.fullName || user?.name}</p>
              <p>{order.shippingAddress?.address1 || '123 Main Street'}</p>
              <p>{order.shippingAddress?.city || 'New York'}, {order.shippingAddress?.state || 'NY'} {order.shippingAddress?.zip || '10001'}</p>
              <p>{order.shippingAddress?.country || 'United States'}</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4" /> Estimated delivery
            </h3>
            <p className="text-sm text-ebay-gray">
              {formatDate(estimatedDelivery)}
            </p>
            <p className="text-xs text-ebay-gray mt-1">Standard Shipping</p>
            {order.trackingNumber && (
              <p className="text-xs mt-2">
                Tracking: <span className="font-mono text-ebay-blue">{order.trackingNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* Payment summary */}
        <div className="p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4" /> Payment summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ebay-gray">Item subtotal</span>
              <span>{formatPrice(auction?.currentPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ebay-gray">Shipping</span>
              <span>{auction?.shippingCost === 0 ? <span className="text-green-700">FREE</span> : formatPrice(auction?.shippingCost || 0)}</span>
            </div>
            {payment?.couponDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>-{formatPrice(payment.couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total paid</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs text-ebay-gray">
              <span>Payment method</span>
              <span className="capitalize">{payment?.method || 'Card'} •••• {payment?.transactionId?.slice(-4) || '4242'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/dashboard/purchases"
          className="w-full sm:w-auto text-center bg-ebay-blue text-white rounded-full px-8 py-3 font-medium hover:bg-ebay-blue-dark"
        >
          <Package className="w-4 h-4 inline mr-2" />
          View order details
        </Link>
        <Link
          href="/search"
          className="w-full sm:w-auto text-center border border-gray-300 rounded-full px-8 py-3 font-medium hover:border-ebay-dark"
        >
          <ShoppingBag className="w-4 h-4 inline mr-2" />
          Continue shopping
        </Link>
      </div>

      {/* Money back guarantee banner */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
        <p className="text-sm font-medium text-ebay-blue">🛡️ AuctionHub Money Back Guarantee</p>
        <p className="text-xs text-ebay-gray mt-1">Get the item you ordered, or your money back. It&apos;s that simple.</p>
      </div>
    </div>
  );
}
