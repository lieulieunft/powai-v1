"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import { useAccount, useDisconnect } from 'wagmi';
import toast from 'react-hot-toast';

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

const Transactions = () => {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [currentTab, setCurrentTab] = useState<'all' | 'sent' | 'received'>('all');

  // Function to handle wallet disconnect
  const handleDisconnect = () => {
    disconnect();
    toast.success('Wallet disconnected successfully');
  };

  // Truncate wallet address for display
  const truncateAddress = (address: string | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Mock data for transactions
  const transactions = [
    { 
      id: 1, 
      type: 'sent', 
      hash: '0x3a8d7f34a8f2e7abb9c8ad5a4b5bcf2c287f8c91c2ba3f7d3a8cb4a4a3b3a3b3',
      from: '0x1234...5678', 
      to: '0xabcd...ef01',
      amount: '0.125', 
      symbol: 'ETH', 
      network: 'Ethereum', 
      timestamp: new Date(Date.now() - 1000 * 60 * 15), 
      status: 'confirmed',
      gasUsed: '21000',
      gasPrice: '25' 
    },
    { 
      id: 2, 
      type: 'received', 
      hash: '0x4f8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
      from: '0xabcd...ef01', 
      to: '0x1234...5678',
      amount: '0.5', 
      symbol: 'ETH', 
      network: 'Sepolia', 
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), 
      status: 'confirmed',
      gasUsed: '21000',
      gasPrice: '20' 
    },
    { 
      id: 3, 
      type: 'sent', 
      hash: '0x9e8d7f6c5b4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8',
      from: '0x1234...5678', 
      to: '0x2468...1357',
      amount: '1.0', 
      symbol: 'ETH', 
      network: 'Base', 
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), 
      status: 'confirmed',
      gasUsed: '21000',
      gasPrice: '15' 
    },
    { 
      id: 4, 
      type: 'received', 
      hash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
      from: '0x5678...1234', 
      to: '0x1234...5678',
      amount: '0.25', 
      symbol: 'ETH', 
      network: 'Holesky', 
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), 
      status: 'confirmed',
      gasUsed: '21000',
      gasPrice: '10' 
    },
  ];

  // Filter transactions based on active tab
  const filteredTransactions = transactions.filter(tx => {
    if (currentTab === 'all') return true;
    return tx.type === currentTab;
  });

  // Format date for display
  const formatDate = (date: Date) => {
    // If less than 24 hours ago, show relative time
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      if (diffHours < 1) {
        const minutes = Math.floor(diffHours * 60);
        return `${minutes} minutes ago`;
      }
      return `${Math.floor(diffHours)} hours ago`;
    }
    
    // Otherwise show the date
    return date.toLocaleDateString('en-US');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center pt-8 px-4">
        <ClientOnly>
          <div className="w-full max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Transaction History</h1>
            
            {isConnected ? (
              <>
                <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
                  {/* Wallet info and disconnect button */}
                  <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                    <div>
                      <div className="text-sm text-gray-600">Connected Wallet</div>
                      <div className="font-medium text-gray-800">{truncateAddress(address)}</div>
                    </div>
                    <button 
                      onClick={handleDisconnect}
                      className="px-4 py-2 bg-white border border-red-500 text-red-500 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                  
                  <div className="flex border-b">
                    <button 
                      className={`flex-1 py-3 px-4 text-center font-medium ${currentTab === 'all' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setCurrentTab('all')}
                    >
                      All
                    </button>
                    <button 
                      className={`flex-1 py-3 px-4 text-center font-medium ${currentTab === 'sent' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setCurrentTab('sent')}
                    >
                      Sent
                    </button>
                    <button 
                      className={`flex-1 py-3 px-4 text-center font-medium ${currentTab === 'received' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setCurrentTab('received')}
                    >
                      Received
                    </button>
                  </div>
                  
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map(tx => (
                      <div key={tx.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${tx.type === 'sent' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {tx.type === 'sent' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{tx.type === 'sent' ? 'Sent' : 'Received'}</div>
                              <div className="text-xs text-gray-500 mt-1">{formatDate(tx.timestamp)}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${tx.type === 'sent' ? 'text-red-600' : 'text-green-600'}`}>
                              {tx.type === 'sent' ? '-' : '+'}{tx.amount} {tx.symbol}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{tx.network}</div>
                          </div>
                        </div>
                        
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                          <div className="flex flex-wrap md:flex-nowrap justify-between gap-2">
                            <div>
                              <span className="font-medium">Hash:</span> 
                              <span className="ml-1 font-mono">{tx.hash.substring(0, 10)}...{tx.hash.substring(tx.hash.length - 8)}</span>
                            </div>
                            <div>
                              <span className="font-medium">Status:</span> 
                              <span className={`ml-1 ${tx.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'}`}>
                                {tx.status === 'confirmed' ? 'Confirmed' : 'Processing'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Gas:</span> 
                              <span className="ml-1">{tx.gasUsed} @ {tx.gasPrice} Gwei</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      No transactions {currentTab === 'sent' ? 'sent' : currentTab === 'received' ? 'received' : ''}
                    </div>
                  )}
                </div>
                
                <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
                  <h2 className="text-xl font-semibold mb-4">Create New Transaction</h2>
                  <p className="text-gray-600 mb-6">
                    Send funds to another address or interact with a smart contract.
                  </p>
                  
                  <button 
                    onClick={() => window.location.href = '/wallet-connect'}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-md font-medium transition duration-200"
                  >
                    Send Transaction
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white shadow-lg rounded-lg p-6 text-center">
                <h2 className="text-xl font-semibold mb-4">Wallet Connect</h2>
                <p className="text-gray-600 mb-6">
                  Connect your wallet to view transaction history and make new transactions.
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

export default Transactions; 