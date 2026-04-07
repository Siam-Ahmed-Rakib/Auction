import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  async getToken() {
    if (typeof window !== 'undefined' && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    }
    return null;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = await this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.error || 'Something went wrong');
    }

    return data;
  }

  // Auth - sync Supabase user to backend
  async syncUser() { return this.request('/auth/sync', { method: 'POST' }); }
  async getMe() { return this.request('/auth/me'); }
  async updateProfile(data) { return this.request('/auth/me', { method: 'PUT', body: JSON.stringify(data) }); }

  // Auctions
  async getAuctions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/auctions?${query}`);
  }
  async getAuction(id) { return this.request(`/auctions/${id}`); }
  async createAuction(data) { return this.request('/auctions', { method: 'POST', body: JSON.stringify(data) }); }
  async updateAuction(id, data) { return this.request(`/auctions/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async cancelAuction(id) { return this.request(`/auctions/${id}/cancel`, { method: 'POST' }); }
  async toggleWatch(id) { return this.request(`/auctions/${id}/watch`, { method: 'POST' }); }
  async getSellingAuctions(status) { return this.request(`/auctions/user/selling${status ? `?status=${status}` : ''}`); }

  // Bids
  async placeBid(auctionId, data) { return this.request(`/bids/${auctionId}`, { method: 'POST', body: JSON.stringify(data) }); }
  async getAuctionBids(auctionId) { return this.request(`/bids/auction/${auctionId}`); }
  async getMyBids(status) { return this.request(`/bids/user/my-bids${status ? `?status=${status}` : ''}`); }

  // Orders
  async getBuyingOrders() { return this.request('/orders/buying'); }
  async getSellingOrders() { return this.request('/orders/selling'); }
  async getOrder(id) { return this.request(`/orders/${id}`); }
  async shipOrder(id, data) { return this.request(`/orders/${id}/ship`, { method: 'PUT', body: JSON.stringify(data) }); }
  async confirmDelivery(id) { return this.request(`/orders/${id}/deliver`, { method: 'POST' }); }

  // Payments
  async processPayment(orderId, data) { return this.request(`/payments/${orderId}/pay`, { method: 'POST', body: JSON.stringify(data) }); }
  async getPayment(orderId) { return this.request(`/payments/${orderId}`); }

  // Feedback
  async leaveFeedback(orderId, data) { return this.request(`/feedback/${orderId}`, { method: 'POST', body: JSON.stringify(data) }); }
  async getUserFeedback(userId) { return this.request(`/feedback/user/${userId}`); }

  // Notifications
  async getNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/notifications?${query}`);
  }
  async markRead(id) { return this.request(`/notifications/${id}/read`, { method: 'PUT' }); }
  async markAllRead() { return this.request('/notifications/read-all', { method: 'PUT' }); }

  // Users
  async getUser(id) { return this.request(`/users/${id}`); }
  async getWatchlist() { return this.request('/users/me/watchlist'); }
  async getStats() { return this.request('/users/me/stats'); }

  // Search
  async search(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/search?${query}`);
  }
  async getCategories() { return this.request('/search/categories'); }
}

const api = new ApiClient();
export default api;
