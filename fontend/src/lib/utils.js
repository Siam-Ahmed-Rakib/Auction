export function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function formatTimeLeft(endTime) {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getTimeUrgency(endTime) {
  const diff = new Date(endTime) - new Date();
  if (diff <= 0) return 'ended';
  if (diff < 60 * 60 * 1000) return 'urgent'; // < 1 hour
  if (diff < 24 * 60 * 60 * 1000) return 'soon'; // < 1 day
  return 'normal';
}

export function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

export function generateOrderNumber() {
  return `EB-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

export const CATEGORIES = [
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'fashion', name: 'Fashion' },
  { slug: 'motors', name: 'Motors' },
  { slug: 'collectibles', name: 'Collectibles and Art' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'health-beauty', name: 'Health & Beauty' },
  { slug: 'industrial', name: 'Industrial Equipment' },
  { slug: 'home-garden', name: 'Home & Garden' },
  { slug: 'phones', name: 'Cell Phones & Accessories' },
  { slug: 'books', name: 'Books & Magazines' },
  { slug: 'video-games', name: 'Video Games & Consoles' },
  { slug: 'clothing', name: 'Clothing, Shoes & Accessories' },
];

export const CONDITIONS = [
  'New',
  'Open Box',
  'Refurbished',
  'Used - Like New',
  'Used - Good',
  'Used - Acceptable',
  'For Parts or Not Working',
];

export const CATEGORY_IMAGES = {
  'electronics': '💻',
  'fashion': '👗',
  'motors': '🚗',
  'collectibles': '🎨',
  'sports': '⚽',
  'health-beauty': '💄',
  'industrial': '🏭',
  'home-garden': '🏡',
  'phones': '📱',
  'books': '📚',
  'video-games': '🎮',
  'clothing': '👔',
};
