'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Bell, CheckCheck, Gavel, CreditCard, Package, Star, AlertTriangle, MessageSquare } from 'lucide-react';

const ICONS = {
  OUTBID: <Gavel className="w-5 h-5 text-orange-500" />,
  BID_PLACED: <Gavel className="w-5 h-5 text-ebay-blue" />,
  AUCTION_WON: <Star className="w-5 h-5 text-green-600" />,
  AUCTION_ENDED: <Bell className="w-5 h-5 text-gray-500" />,
  AUCTION_SOLD: <CreditCard className="w-5 h-5 text-green-600" />,
  PAYMENT_RECEIVED: <CreditCard className="w-5 h-5 text-green-600" />,
  PAYMENT_RELEASED: <CreditCard className="w-5 h-5 text-ebay-blue" />,
  ORDER_SHIPPED: <Package className="w-5 h-5 text-purple-600" />,
  ORDER_DELIVERED: <Package className="w-5 h-5 text-green-600" />,
  FEEDBACK_RECEIVED: <Star className="w-5 h-5 text-yellow-500" />,
  DISPUTE_OPENED: <AlertTriangle className="w-5 h-5 text-red-500" />,
  WATCHING_ENDING: <Bell className="w-5 h-5 text-ebay-blue" />,
  NEW_BID_ON_LISTING: <MessageSquare className="w-5 h-5 text-ebay-blue" />,
};

function getNotificationLink(notif) {
  const auctionId = notif.data?.auctionId;
  if (auctionId) return `/auctions/${auctionId}`;
  const orderId = notif.data?.orderId;
  if (orderId) return `/orders/${orderId}`;
  return null;
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  // Listen for real-time notifications
  useEffect(() => {
    if (socket) {
      const handleNotification = (data) => {
        setNotifications(prev => [data, ...prev]);
      };
      socket.on('notification', handleNotification);
      return () => socket.off('notification', handleNotification);
    }
  }, [socket]);

  async function loadNotifications() {
    try {
      setError(null);
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id) {
    try {
      await api.markRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  }

  function handleNotificationClick(notif) {
    if (!notif.read) handleMarkRead(notif.id);
    const link = getNotificationLink(notif);
    if (link) router.push(link);
  }

  if (authLoading || !user) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-ebay-gray">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-ebay-blue hover:underline flex items-center gap-1"
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="animate-pulse border rounded-xl p-4 flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-gray-200 h-4 rounded w-3/4" />
                <div className="bg-gray-200 h-3 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 border border-red-200 rounded-xl bg-red-50">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-lg font-bold mb-2">Failed to load notifications</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button onClick={loadNotifications} className="text-sm text-ebay-blue hover:underline">Try again</button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-bold mb-2">No notifications</p>
          <p className="text-sm text-ebay-gray">You&apos;re all caught up! Start bidding to receive updates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const link = getNotificationLink(notif);
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`border rounded-xl p-4 flex gap-3 cursor-pointer transition hover:shadow-sm ${
                  !notif.read ? 'bg-blue-50 border-blue-200' : 'bg-white'
                }`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  {ICONS[notif.type] || <Bell className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${!notif.read ? 'text-ebay-dark' : 'text-gray-700'}`}>
                    {notif.title}
                  </p>
                  <p className={`text-sm mt-0.5 ${!notif.read ? '' : 'text-ebay-gray'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-ebay-gray mt-1">{formatDate(notif.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {link && (
                    <Link
                      href={link}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-ebay-blue hover:underline bg-blue-50 px-3 py-1.5 rounded-full font-medium"
                    >
                      View item
                    </Link>
                  )}
                  {!notif.read && (
                    <div className="w-2.5 h-2.5 bg-ebay-blue rounded-full flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
