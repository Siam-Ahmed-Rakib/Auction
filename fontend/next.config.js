/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'via.placeholder.com', 'picsum.photos', 'images.unsplash.com'],
    unoptimized: true
  }
}

module.exports = nextConfig
