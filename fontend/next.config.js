/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost',
      'via.placeholder.com',
      'picsum.photos',
      'images.unsplash.com',
      'auction-api-5lfe.onrender.com',
      'lmthclkskkechzyfenuf.supabase.co'
    ],
    unoptimized: true
  }
}

module.exports = nextConfig
