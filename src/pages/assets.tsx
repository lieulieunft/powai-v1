"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import { useAccount } from 'wagmi';

// Component for safe client-side rendering
const ClientOnly: React.FC<{children: ReactNode}> = ({ children }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
};

const Assets: React.FC = () => {
  const { isConnected } = useAccount();

  // Mock data for assets
  const assets = [
    { id: 1, name: 'Ethereum', symbol: 'ETH', amount: '1.234', value: '3,456.78', change: '+5.6' },
    { id: 2, name: 'Base', symbol: 'ETH', amount: '2.345', value: '6,543.21', change: '-2.3' },
    { id: 3, name: 'Holesky', symbol: 'HETH', amount: '10.000', value: '0.00', change: '0.0' },
    { id: 4, name: 'Sepolia', symbol: 'SETH', amount: '15.000', value: '0.00', change: '0.0' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center pt-8 px-4">
        <ClientOnly>
          <div className="w-full max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Asset Management</h1>
            
            {isConnected ? (
              <>
                <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
                  <div className="p-6 bg-blue-500 text-white">
                    <h2 className="text-xl font-semibold">Total Asset Value</h2>
                    <p className="text-3xl font-bold mt-2">10,000.00 USD</p>
                    <p className="text-sm mt-1">Last updated: {new Date().toLocaleString()}</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-gray-500">Asset</div>
                      <div className="flex space-x-8">
                        <div className="text-sm font-medium text-gray-500 text-right">Amount</div>
                        <div className="text-sm font-medium text-gray-500 text-right">Value (USD)</div>
                        <div className="text-sm font-medium text-gray-500 text-right">24h Change</div>
                      </div>
                    </div>
                  </div>
                  
                  {assets.map(asset => (
                    <div key={asset.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-bold mr-3">
                            {asset.symbol.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{asset.name}</div>
                            <div className="text-sm text-gray-500">{asset.symbol}</div>
                          </div>
                        </div>
                        <div className="flex space-x-8">
                          <div className="text-right w-24">
                            <div className="font-medium">{asset.amount}</div>
                            <div className="text-sm text-gray-500">{asset.symbol}</div>
                          </div>
                          <div className="text-right w-24">
                            <div className="font-medium">${asset.value}</div>
                          </div>
                          <div className={`text-right w-24 ${
                            parseFloat(asset.change) > 0 
                              ? 'text-green-600' 
                              : parseFloat(asset.change) < 0 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                          }`}>
                            {parseFloat(asset.change) > 0 ? '+' : ''}{asset.change}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-white shadow rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Send</h3>
                    <p className="text-sm text-gray-600 mb-4">Transfer funds to another wallet</p>
                    <button className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium transition duration-200 w-full">
                      Send
                    </button>
                  </div>
                  
                  <div className="bg-white shadow rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Receive</h3>
                    <p className="text-sm text-gray-600 mb-4">Display your wallet address</p>
                    <button className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium transition duration-200 w-full">
                      Receive
                    </button>
                  </div>
                  
                  <div className="bg-white shadow rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Swap</h3>
                    <p className="text-sm text-gray-600 mb-4">Exchange between currencies</p>
                    <button className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md text-sm font-medium transition duration-200 w-full">
                      Swap
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white shadow-lg rounded-lg p-6 text-center">
                <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
                <p className="text-gray-600 mb-6">
                  Please connect your wallet to view assets and perform transactions.
                </p>
                <button 
                  onClick={() => window.location.href = '/wallet-connect'}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-md font-medium transition duration-200"
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        </ClientOnly>
      </main>
      
      <footer className="py-4 bg-white shadow-inner mt-12">
        <p className="text-center text-gray-600 text-sm">
          © 2023 PowAI. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Assets; 