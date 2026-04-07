'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { CreditCard, Shield, Truck, ChevronRight, Loader2 } from 'lucide-react';

export default function CheckoutPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [shippingAddress, setShippingAddress] = useState({
    fullName: '', address1: '', address2: '', city: '', state: '', zip: '', country: 'US'
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && id) loadOrder();
  }, [user, id]);

  async function loadOrder() {
    try {
      const orders = await api.getBuyerOrders();
      const found = orders.find(o => o.id === id || o.auctionId === id);
      if (found) {
        setOrder(found);
        if (user) {
          setShippingAddress(prev => ({
            ...prev,
            fullName: user.name || user.username,
          }));
        }
      } else {
        // Try to load auction directly for Buy-It-Now
        const auction = await api.getAuction(id);
        setOrder({
          auctionId: auction.id,
          auction,
          totalAmount: auction.currentPrice + (auction.shippingCost || 0),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function applyCoupon() {
    if (couponCode.toUpperCase() === 'SAVE10') {
      setCouponApplied({ code: 'SAVE10', type: 'percent', value: 10 });
    } else if (couponCode.toUpperCase() === 'SAVE5') {
      setCouponApplied({ code: 'SAVE5', type: 'fixed', value: 5 });
    } else {
      setCouponApplied({ error: 'Invalid coupon code' });
    }
  }

  function getDiscount() {
    if (!couponApplied || couponApplied.error) return 0;
    const itemPrice = order?.auction?.currentPrice || order?.totalAmount || 0;
    if (couponApplied.type === 'percent') return itemPrice * (couponApplied.value / 100);
    return Math.min(couponApplied.value, itemPrice);
  }

  function getTotal() {
    const itemPrice = order?.auction?.currentPrice || order?.totalAmount || 0;
    const shipping = order?.auction?.shippingCost || 0;
    return itemPrice + shipping - getDiscount();
  }

  async function handlePayment(e) {
    e.preventDefault();
    setProcessing(true);
    try {
      const orderId = order?.id;
      if (!orderId) {
        throw new Error('Order not found. Payment cannot proceed.');
      }
      await api.processPayment({
        orderId,
        paymentMethod,
        amount: getTotal(),
        couponCode: couponApplied?.code,
        shippingAddress,
      });
      router.push(`/payment-success/${orderId}`);
    } catch (err) {
      alert(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  }

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="bg-gray-200 h-8 rounded w-1/4" />
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-4">
              <div className="bg-gray-200 h-40 rounded-xl" />
              <div className="bg-gray-200 h-40 rounded-xl" />
            </div>
            <div className="bg-gray-200 h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <p className="text-lg mb-4">Order not found</p>
        <a href="/dashboard/bids" className="text-ebay-blue underline">Back to Bids</a>
      </div>
    );
  }

  const auction = order.auction;
  const itemPrice = auction?.currentPrice || order.totalAmount;
  const shippingCost = auction?.shippingCost || 0;

  const paymentMethods = [
    { id: 'paypal', label: 'PayPal', icon: '🅿️', desc: 'Pay with your PayPal account' },
    { id: 'card', label: 'Debit or credit card', icon: '💳', desc: 'Visa, Mastercard, Amex' },
    { id: 'gpay', label: 'Google Pay', icon: '🟢', desc: 'Fast checkout with Google' },
    { id: 'applepay', label: 'Apple Pay', icon: '🍎', desc: 'Pay with Apple Pay' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ebay-gray mb-6">
        <span>Checkout</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-ebay-dark font-medium">Review and pay</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <form onSubmit={handlePayment}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Shipping address */}
            <div className="border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" /> Shipping address
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1">Full name</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.fullName}
                    onChange={e => setShippingAddress(p => ({ ...p, fullName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1">Address line 1</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.address1}
                    onChange={e => setShippingAddress(p => ({ ...p, address1: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium block mb-1">Address line 2 <span className="text-ebay-gray">(optional)</span></label>
                  <input
                    type="text"
                    value={shippingAddress.address2}
                    onChange={e => setShippingAddress(p => ({ ...p, address2: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.city}
                    onChange={e => setShippingAddress(p => ({ ...p, city: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium block mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.state}
                      onChange={e => setShippingAddress(p => ({ ...p, state: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">ZIP code</label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.zip}
                      onChange={e => setShippingAddress(p => ({ ...p, zip: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="border rounded-xl p-5">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Pay with
              </h2>
              <div className="space-y-3">
                {paymentMethods.map(pm => (
                  <label
                    key={pm.id}
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition ${
                      paymentMethod === pm.id ? 'border-ebay-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.id}
                      checked={paymentMethod === pm.id}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="accent-ebay-blue"
                    />
                    <span className="text-xl">{pm.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{pm.label}</p>
                      <p className="text-xs text-ebay-gray">{pm.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {paymentMethod === 'card' && (
                <div className="mt-4 border-t pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Card number</label>
                    <input
                      type="text"
                      maxLength={19}
                      placeholder="1234 5678 9012 3456"
                      value={cardDetails.number}
                      onChange={e => setCardDetails(p => ({ ...p, number: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Expiry</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardDetails.expiry}
                        onChange={e => setCardDetails(p => ({ ...p, expiry: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">CVV</label>
                      <input
                        type="text"
                        placeholder="123"
                        maxLength={4}
                        value={cardDetails.cvv}
                        onChange={e => setCardDetails(p => ({ ...p, cvv: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Name on card</label>
                      <input
                        type="text"
                        value={cardDetails.name}
                        onChange={e => setCardDetails(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Coupon */}
            <div className="border rounded-xl p-5">
              <h3 className="font-medium text-sm mb-3">Have a coupon?</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="Enter code (try SAVE10)"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="border border-ebay-blue text-ebay-blue rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-50"
                >
                  Apply
                </button>
              </div>
              {couponApplied && !couponApplied.error && (
                <p className="text-xs text-green-700 mt-2">
                  ✅ Coupon {couponApplied.code} applied! You save {couponApplied.type === 'percent' ? `${couponApplied.value}%` : formatPrice(couponApplied.value)}
                </p>
              )}
              {couponApplied?.error && (
                <p className="text-xs text-red-600 mt-2">{couponApplied.error}</p>
              )}
            </div>
          </div>

          {/* Right column — Order summary */}
          <div>
            <div className="border rounded-xl p-5 sticky top-4">
              <h2 className="font-bold text-lg mb-4">Order summary</h2>

              {/* Item preview */}
              <div className="flex gap-3 pb-4 border-b">
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {auction?.images?.[0] ? (
                    <img src={auction.images[0]} alt="" className="max-h-full max-w-full object-contain" />
                  ) : <span className="text-2xl">📦</span>}
                </div>
                <div className="text-sm">
                  <p className="font-medium line-clamp-2">{auction?.title}</p>
                  <p className="text-xs text-ebay-gray mt-1">{auction?.condition}</p>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ebay-gray">Item price</span>
                  <span>{formatPrice(itemPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ebay-gray">Shipping</span>
                  <span>{shippingCost === 0 ? <span className="text-green-700 font-medium">FREE</span> : formatPrice(shippingCost)}</span>
                </div>
                {getDiscount() > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Coupon ({couponApplied.code})</span>
                    <span>-{formatPrice(getDiscount())}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t text-lg">
                  <span>Total</span>
                  <span>{formatPrice(getTotal())}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full mt-5 bg-ebay-blue text-white rounded-full py-3 font-medium flex items-center justify-center gap-2 hover:bg-ebay-blue-dark disabled:opacity-50"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  `Confirm and pay ${formatPrice(getTotal())}`
                )}
              </button>

              <div className="mt-4 flex items-start gap-2 text-xs text-ebay-gray">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>AuctionHub Money Back Guarantee. Get the item you ordered, or your money back.</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
