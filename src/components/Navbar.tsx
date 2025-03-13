"use client";

import { FC, useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { useAccount, useBalance, useDisconnect } from 'wagmi';

// Props type
interface NavbarProps {
  selectedNetwork?: {
    id: number;
    name: string;
  };
}

// Component for safe client-side rendering
const ClientOnly: FC<{children: ReactNode}> = ({ children }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
};

const Navbar: FC<NavbarProps> = ({ selectedNetwork }) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
  });
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Truncate wallet address for display
  const truncateAddress = (address: string | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle copying address
  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setShowCopiedTooltip(true);
      setTimeout(() => setShowCopiedTooltip(false), 2000);
    }
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/" className="font-bold text-xl text-blue-600">PowAI</Link>
            <div className="hidden md:flex space-x-4">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors">Home</Link>
              <Link href="/wallet-connect" className="text-gray-600 hover:text-blue-600 transition-colors">Wallet</Link>
              <Link href="/assets" className="text-gray-600 hover:text-blue-600 transition-colors">Assets</Link>
              <Link href="/transactions" className="text-gray-600 hover:text-blue-600 transition-colors">Transactions</Link>
              <Link href="/ai-powered" className="text-gray-600 hover:text-blue-600 transition-colors">AI Powered</Link>
            </div>
          </div>
          
          <ClientOnly>
            {isConnected ? (
              <div className="flex items-center space-x-4">
                {selectedNetwork && (
                  <div className="hidden md:flex items-center">
                    <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      {selectedNetwork.name}
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2 relative">
                  <div className="hidden md:block text-gray-500 text-xs">
                    {isBalanceLoading ? 'Loading...' : `${parseFloat(balanceData?.formatted || '0').toFixed(4)} ${balanceData?.symbol || 'ETH'}`}
                  </div>
                  <div 
                    className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm cursor-pointer flex items-center"
                    onClick={handleCopyAddress}
                    title="Click to copy address"
                  >
                    <span>{truncateAddress(address)}</span>
                    <svg className="w-3 h-3 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                  {showCopiedTooltip && (
                    <div className="absolute -bottom-8 right-0 bg-gray-800 text-white text-xs py-1 px-2 rounded shadow-md">
                      Copied!
                    </div>
                  )}
                  <div className="md:hidden">
                    <button
                      onClick={() => setShowMobileMenu(!showMobileMenu)}
                      className="text-gray-500 focus:outline-none"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <Link href="/wallet-connect" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium">
                  Connect Wallet
                </Link>
                <div className="md:hidden ml-2">
                  <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="text-gray-500 focus:outline-none"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </ClientOnly>
        </div>
        
        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              <Link href="/" className="text-gray-600 hover:text-blue-600 transition-colors">Home</Link>
              <Link href="/wallet-connect" className="text-gray-600 hover:text-blue-600 transition-colors">Wallet</Link>
              <Link href="/assets" className="text-gray-600 hover:text-blue-600 transition-colors">Assets</Link>
              <Link href="/transactions" className="text-gray-600 hover:text-blue-600 transition-colors">Transactions</Link>
              <Link href="/ai-powered" className="text-gray-600 hover:text-blue-600 transition-colors">AI Powered</Link>
              
              <ClientOnly>
                {isConnected && (
                  <>
                    <div className="pt-2 border-t border-gray-200">
                      {selectedNetwork && (
                        <div className="py-1 mb-2">
                          <span className="text-xs text-gray-500">Network:</span>
                          <span className="ml-2 text-blue-600 text-sm">{selectedNetwork.name}</span>
                        </div>
                      )}
                      <div className="py-1 mb-2">
                        <span className="text-xs text-gray-500">Balance:</span>
                        <span className="ml-2 text-sm">
                          {isBalanceLoading ? 'Loading...' : `${parseFloat(balanceData?.formatted || '0').toFixed(4)} ${balanceData?.symbol || 'ETH'}`}
                        </span>
                      </div>
                      <button 
                        className="mt-2 text-red-500 hover:text-red-600 text-sm"
                        onClick={() => disconnect()}
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  </>
                )}
              </ClientOnly>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar; 