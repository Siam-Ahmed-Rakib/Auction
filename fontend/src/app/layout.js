import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'AuctionHub - Online Auction Platform',
  description: 'Buy and sell items through exciting online auctions. eBay-style bidding platform.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white">
        <AuthProvider>
          <SocketProvider>
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
