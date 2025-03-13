"use client";

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { injected, metaMask, coinbaseWallet, walletConnect } from 'wagmi/connectors';
import { mainnet, sepolia, base, baseSepolia, holesky, avalanche, bsc } from 'wagmi/chains';
import { FC, ReactNode } from 'react';
import type { Hash } from 'viem';
import Navbar from '@/components/Navbar';
import { parseEther } from 'viem';
import toast from 'react-hot-toast';

// Tipo para la declaración global de window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
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

// Wallet configuration data
interface WalletConfig {
  id: string;
  name: string;
  icon: string;
  connector: any;
  installed?: boolean;
  downloadUrl: string | null;
  description: string;
}

// Network configuration data
interface NetworkConfig {
  id: number;
  name: string;
  chainObj: any;
  icon: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Define Monad chain since it might not be in wagmi/chains
const monad = {
  id: 1337,
  name: 'Monad',
  network: 'monad',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MONAD',
  },
  rpcUrls: {
    public: { http: ['https://rpc.monad.xyz'] },
    default: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    etherscan: { name: 'Monad Explorer', url: 'https://explorer.monad.xyz' },
    default: { name: 'Monad Explorer', url: 'https://explorer.monad.xyz' },
  }
};

const SUPPORTED_NETWORKS: NetworkConfig[] = [
  {
    id: mainnet.id,
    name: 'Mainnet',
    chainObj: mainnet,
    icon: '/ethereum.png',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: sepolia.id,
    name: 'Sepolia',
    chainObj: sepolia,
    icon: '/sepolia.png',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: base.id,
    name: 'Base',
    chainObj: base,
    icon: '/base.png',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Base Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: baseSepolia.id,
    name: 'Base Sepolia',
    chainObj: baseSepolia,
    icon: '/base-sepolia.png',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: holesky.id,
    name: 'Holesky',
    chainObj: holesky,
    icon: '/holesky.png',
    rpcUrl: 'https://holesky.infura.io/v3/',
    blockExplorer: 'https://holesky.etherscan.io',
    nativeCurrency: {
      name: 'Holesky Ether',
      symbol: 'ETH',
      decimals: 18
    }
  },
  {
    id: monad.id,
    name: 'Monad',
    chainObj: monad,
    icon: '/monad.png',
    rpcUrl: 'https://rpc.monad.xyz',
    blockExplorer: 'https://explorer.monad.xyz',
    nativeCurrency: {
      name: 'Monad',
      symbol: 'MONAD',
      decimals: 18
    }
  },
  {
    id: avalanche.id,
    name: 'Avalanche',
    chainObj: avalanche,
    icon: '/avalanche.png',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18
    }
  },
  {
    id: bsc.id,
    name: 'BNB Chain',
    chainObj: bsc,
    icon: '/bnb.png',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: {
      name: 'Binance Coin',
      symbol: 'BNB',
      decimals: 18
    }
  }
];

const WalletConnect: FC = () => {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChain } = useSwitchChain();
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(SUPPORTED_NETWORKS[0]);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  
  // State for wallets
  const [wallets, setWallets] = useState<WalletConfig[]>([]);
  const [isClient, setIsClient] = useState(false);
  
  // Detect client side
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Initialize wallets with detection on client side only
  useEffect(() => {
    if (!isClient) return;
    
    const detectWallets = () => {
      try {
        // Fallback for detecting wallets
        const defaultWalletConfig: WalletConfig[] = [
          {
            id: 'metamask',
            name: 'MetaMask',
            icon: '/metamask.png',
            connector: metaMask,
            installed: false,
            downloadUrl: 'https://metamask.io/download/',
            description: 'Ví tiền điện tử phổ biến',
          },
          {
            id: 'coinbase',
            name: 'Coinbase Wallet',
            icon: '/coinbase.png',
            connector: coinbaseWallet,
            installed: false,
            downloadUrl: 'https://www.coinbase.com/wallet/downloads',
            description: 'Ví không ủy thác của Coinbase',
          },
          {
            id: 'walletconnect',
            name: 'WalletConnect',
            icon: '/walletconnect.png',
            connector: walletConnect,
            installed: true, // Always available
            downloadUrl: null,
            description: 'Kết nối với ví di động',
          },
        ];

        const ethereum = window.ethereum;
        
        // Función de ayuda para verificar si un wallet está instalado
        const isWalletInstalled = (checkProperty: string): boolean => {
          return !!ethereum && !!ethereum[checkProperty];
        };
        
        // Función de ayuda para verificar wallets a través de providers array
        const hasProvider = (name: string): boolean => {
          return !!ethereum?.providers?.some((provider: any) => provider[name]);
        };
        
        // Check if we have access to window.ethereum
        if (ethereum) {
          const walletsConfig: WalletConfig[] = [
            {
              id: 'metamask',
              name: 'MetaMask',
              icon: '/metamask.png',
              connector: metaMask,
              installed: isWalletInstalled('isMetaMask') && !isWalletInstalled('isCoinbaseWallet'),
              downloadUrl: 'https://metamask.io/download/',
              description: 'Ví tiền điện tử phổ biến',
            },
            {
              id: 'coinbase',
              name: 'Coinbase Wallet',
              icon: '/coinbase.png',
              connector: coinbaseWallet,
              installed: isWalletInstalled('isCoinbaseWallet'),
              downloadUrl: 'https://www.coinbase.com/wallet/downloads',
              description: 'Ví không ủy thác của Coinbase',
            },
            {
              id: 'okx',
              name: 'OKX Wallet',
              icon: '/okx.png',
              connector: injected,
              installed: isWalletInstalled('isOKXWallet'),
              downloadUrl: 'https://www.okx.com/web3',
              description: 'Ví đa chuỗi',
            },
            {
              id: 'rabby',
              name: 'Rabby Wallet',
              icon: '/rabby.png',
              connector: injected,
              installed: isWalletInstalled('isRabby'),
              downloadUrl: 'https://rabby.io/',
              description: 'Ví bảo mật cao',
            },
            {
              id: 'backpack',
              name: 'Backpack',
              icon: '/backpack.png',
              connector: injected,
              installed: isWalletInstalled('isBackpack'),
              downloadUrl: 'https://www.backpack.app/',
              description: 'Ví đa chuỗi',
            },
            {
              id: 'walletconnect',
              name: 'WalletConnect',
              icon: '/walletconnect.png',
              connector: walletConnect,
              installed: true, // Always available
              downloadUrl: null,
              description: 'Kết nối với ví di động',
            },
          ];
          
          setWallets(walletsConfig);
        } else {
          // No ethereum object, fallback to default wallets
          console.log('No ethereum object detected, fallback to default wallets');
          setWallets(defaultWalletConfig);
        }
      } catch (error) {
        console.error('Error detecting wallets:', error);
        // Fallback to basic wallets
        setWallets([
          {
            id: 'metamask',
            name: 'MetaMask',
            icon: '/metamask.png',
            connector: metaMask,
            installed: false,
            downloadUrl: 'https://metamask.io/download/',
            description: 'Ví tiền điện tử phổ biến',
          },
          {
            id: 'walletconnect',
            name: 'WalletConnect',
            icon: '/walletconnect.png',
            connector: walletConnect,
            installed: true, // Always available
            downloadUrl: null,
            description: 'Kết nối với ví di động',
          },
        ]);
      }
    };
    
    // Execute on client side
    detectWallets();
  }, [isClient]);
  
  // Get wallet balance
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
  });

  // State for wallet selection
  const [showWalletOptions, setShowWalletOptions] = useState(false);
  
  // State for transaction form
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | undefined>();
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  
  // State for UI feedback
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  
  // Send transaction
  const { sendTransaction, isPending: isSendingTransaction, error: sendTransactionError, data: sendTxData } = useSendTransaction();

  // Update transaction hash when transaction is sent
  useEffect(() => {
    if (sendTxData) {
      console.log('Transaction sent with hash:', sendTxData);
      setTransactionHash(sendTxData);
    }
  }, [sendTxData]);

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  // Handle transaction status changes
  useEffect(() => {
    if (transactionHash && !isConfirming && !isConfirmed) {
      setTransactionStatus('pending');
    }
  }, [transactionHash, isConfirming, isConfirmed]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && transactionHash) {
      setTransactionStatus('success');
      
      // Hiển thị thông báo thành công
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
      } catch (error) {
        console.error('Vibration error:', error);
      }
      
      // Reset form after successful transaction
      const timer = setTimeout(() => {
        setShowTransactionForm(false);
        setTransactionHash(undefined);
        setRecipientAddress('');
        setAmount('');
        setTransactionStatus('idle');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, transactionHash]);
  
  // Handle transaction error
  useEffect(() => {
    if (confirmError) {
      setTransactionStatus('error');
    }
  }, [confirmError]);

  // Handle sending transaction
  const handleSendTransaction = () => {
    try {
      if (!recipientAddress || !amount) return;
      
      // Đặt trạng thái về pending (chuẩn bị gửi)
      setTransactionStatus('pending');
      
      // Tính toán giá trị giao dịch
      const value = BigInt(Math.floor(parseFloat(amount) * 10 ** 18));
      
      console.log(`Sending ${amount} ETH to ${recipientAddress}...`);
      
      // Gửi giao dịch
      sendTransaction({
        to: recipientAddress as `0x${string}`,
        value: value,
      });
      
      // Hash sẽ được cập nhật qua các hook effect khi sendTransaction thành công
    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionStatus('error');
    }
  };

  // Handle wallet connection
  const handleConnectWallet = (wallet: WalletConfig) => {
    try {
      console.log('Connecting to wallet:', wallet.name);
      const connector = wallet.connector();
      connect({ connector });
      
      // Log connection attempt
      console.log(`Attempting to connect with ${wallet.name}`);
      
      // Close wallet selection after attempt
      setTimeout(() => {
        setShowWalletOptions(false);
      }, 1000);
    } catch (error) {
      console.error('Connection initialization error:', error);
    }
  };

  // Truncate wallet address for display
  const truncateAddress = (address: string | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Function to handle network switching
  const handleNetworkSwitch = async (network: NetworkConfig) => {
    setSelectedNetwork(network);
    if (switchChain && isConnected) {
      try {
        setIsSwitchingNetwork(true);
        await switchChain({ chainId: network.id });
        // Success delay
        setTimeout(() => setIsSwitchingNetwork(false), 500);
        toast.success(`Switched to ${network.name} network`);
      } catch (error: unknown) {
        console.error('Error switching chain:', error);
        // Attempt to add the network if switching failed
        await addNetworkToWallet(network);
        setIsSwitchingNetwork(false);
      }
    } else if (isConnected) {
      // If switchChain is not available but connected, try to add network directly
      await addNetworkToWallet(network);
    }
  };

  // New function to add a network to the wallet
  const addNetworkToWallet = async (network: NetworkConfig) => {
    if (!window.ethereum) {
      toast.error('No Ethereum provider found. Please install a wallet like MetaMask.');
      return;
    }

    try {
      setIsSwitchingNetwork(true);
      toast.loading(`Adding ${network.name} network to your wallet...`);

      // Format the network for the wallet_addEthereumChain method
      const params = {
        chainId: `0x${network.id.toString(16)}`, // Convert to hex string
        chainName: network.name,
        nativeCurrency: {
          name: network.nativeCurrency.name,
          symbol: network.nativeCurrency.symbol,
          decimals: network.nativeCurrency.decimals,
        },
        rpcUrls: [network.rpcUrl],
        blockExplorerUrls: [network.blockExplorer],
      };

      // Request the wallet to add the network
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [params],
      });

      toast.dismiss();
      toast.success(`${network.name} network added to your wallet`);
      
      // Small delay to ensure UI updates
      setTimeout(() => setIsSwitchingNetwork(false), 500);
    } catch (error: any) {
      toast.dismiss();
      console.error('Error adding network:', error);
      toast.error(error.message || `Failed to add ${network.name} network`);
      setIsSwitchingNetwork(false);
    }
  };

  // Update switch network function
  const handleSwitchToCorrectNetwork = async () => {
    if (isClient && switchChain) {
      try {
        setIsSwitchingNetwork(true);
        await switchChain({ chainId: selectedNetwork.id });
        // Success delay
        setTimeout(() => setIsSwitchingNetwork(false), 500);
        toast.success(`Switched to ${selectedNetwork.name} network`);
      } catch (error: unknown) {
        console.error('Error switching chain:', error);
        // Attempt to add the network if switching failed
        await addNetworkToWallet(selectedNetwork);
        setIsSwitchingNetwork(false);
      }
    } else if (isClient && window.ethereum) {
      // Direct add/switch if switchChain is not available
      await addNetworkToWallet(selectedNetwork);
    } else {
      toast.error(`Please manually switch to ${selectedNetwork.name} in your wallet`);
    }
  };

  // Update the network validation logic
  useEffect(() => {
    if (isClient && isConnected) {
      // Check if the current chainId matches the selected network
      if (chainId !== selectedNetwork.id) {
        setIsWrongNetwork(true);
      } else {
        setIsWrongNetwork(false);
      }
    }
  }, [isConnected, address, chainId, selectedNetwork, isClient]);

  // Get transaction status message
  const getTransactionStatusMessage = (): ReactNode => {
    switch (transactionStatus) {
      case 'pending':
        return isConfirming ? 
          <div className="bg-blue-100 p-3 rounded-md text-blue-700 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">Đang xác nhận giao dịch...</p>
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
            <p className="text-sm mt-1">Giao dịch đang được xác nhận trên blockchain. Vui lòng đợi.</p>
            {transactionHash && (
              <div className="mt-2 text-xs break-all bg-blue-50 p-2 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Hash:</span>
                  <a 
                    href={`${selectedNetwork.blockExplorer}/tx/${transactionHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline ml-2"
                  >
                    Xem trên explorer
                  </a>
                </div>
                <span className="text-gray-600">{transactionHash}</span>
              </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
              <div className="bg-blue-600 h-1.5 rounded-full w-2/5 animate-pulse"></div>
            </div>
          </div> :
          <div className="bg-blue-100 p-3 rounded-md text-blue-700 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">Đang gửi giao dịch...</p>
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
            <p className="text-sm mt-1">Vui lòng xác nhận giao dịch trong ví của bạn.</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
              <div className="bg-blue-600 h-1.5 rounded-full w-1/5 animate-pulse"></div>
            </div>
          </div>;
      case 'success':
        return (
          <div className="bg-green-100 p-3 rounded-md text-green-700 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">Giao dịch thành công!</p>
              <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div className="mt-2 bg-green-50 p-2 rounded">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-gray-600">Người nhận:</span>
                <span className="font-medium">{truncateAddress(recipientAddress as string)}</span>
                
                <span className="text-gray-600">Số lượng:</span>
                <span className="font-medium">{amount} ETH</span>
                
                <span className="text-gray-600">Mạng:</span>
                <span className="font-medium">{selectedNetwork.name}</span>
                
                <span className="text-gray-600">Trạng thái:</span>
                <span className="font-medium">Đã xác nhận</span>
              </div>
            </div>
            {transactionHash && (
              <div className="mt-3 text-center">
                <a 
                  href={`${selectedNetwork.blockExplorer}/tx/${transactionHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline text-xs inline-flex items-center"
                >
                  <span>Xem chi tiết giao dịch trên {selectedNetwork.name} Explorer</span>
                  <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </div>
            )}
          </div>
        );
      case 'error':
        return (
          <div className="bg-red-100 p-3 rounded-md text-red-700 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">Giao dịch thất bại!</p>
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <div className="bg-red-50 p-2 rounded text-sm mt-1">
              <p className="text-red-800 font-medium">Lỗi:</p>
              <p className="text-sm">{sendTransactionError?.message || confirmError?.message || 'Không thể hoàn thành giao dịch. Vui lòng thử lại sau.'}</p>
            </div>
            <div className="mt-3 flex justify-between">
              <button 
                className="text-red-600 hover:text-red-800 text-sm underline"
                onClick={() => setTransactionStatus('idle')}
              >
                Thử lại
              </button>
              <button 
                className="text-gray-600 hover:text-gray-800 text-sm"
                onClick={() => {
                  setShowTransactionForm(false);
                  setTransactionStatus('idle');
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Render wallet item
  const renderWalletItem = (wallet: WalletConfig, isInstalled: boolean) => {
    const content = (
      <div className="flex items-center">
        <div className="w-10 h-10 mr-3 flex-shrink-0 relative bg-gray-200 rounded-full flex items-center justify-center text-lg font-bold text-gray-700">
          {wallet.name.charAt(0)}
        </div>
        <div>
          <span className="block font-medium">{wallet.name}</span>
          <span className="block text-xs text-gray-500">{wallet.description}</span>
        </div>
      </div>
    );
    
    // WalletConnect is always treated as installed
    const actuallyInstalled = wallet.id === 'walletconnect' || isInstalled;
    
    if (actuallyInstalled) {
      return (
        <button
          key={wallet.id}
          className="flex items-center justify-between w-full p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors text-left"
          onClick={() => handleConnectWallet(wallet)}
        >
          {content}
          <span className="text-blue-500 text-sm font-medium">Kết nối</span>
        </button>
      );
    } else {
      return (
        <a
          key={wallet.id}
          href={wallet.downloadUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors text-left"
        >
          {content}
          <span className="text-green-500 text-sm font-medium">Cài đặt</span>
        </a>
      );
    }
  };

  // Handle copying address
  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
    }
  };

  // Xử lý chuyển mạng
  const handleNetworkChange = (network: NetworkConfig) => {
    setSelectedNetwork(network);
    if (switchChain) {
      switchChain({ chainId: network.id });
    }
  };

  // Function to send a test transaction (testnet only)
  const handleSendTestTransaction = async () => {
    try {
      if (!address) {
        alert('Please connect your wallet first');
        return;
      }

      if (selectedNetwork.id === mainnet.id || selectedNetwork.id === base.id) {
        alert('Cannot send test ETH on mainnet. Please switch to a testnet.');
        return;
      }

      // Send a 0 ETH transaction to yourself (just for testing)
      sendTransaction({
        to: address,
        value: parseEther('0'),
      });

      alert('Transaction initiated! Check your wallet for confirmation.');
    } catch (error: any) {
      console.error('Transaction error:', error);
      alert(error.message || 'Error sending transaction');
    }
  };

  // Phân loại các ví thành đã cài đặt và chưa cài đặt
  const installedWallets = isClient ? connectors.filter(connector => connector.ready) : [];
  const notInstalledWallets = isClient ? connectors.filter(connector => !connector.ready) : [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar selectedNetwork={selectedNetwork} />
      
      <main className="flex-1 flex flex-col items-center justify-center pt-8 px-4">
        <div className="w-full max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Wallet Management</h1>
          
          <ClientOnly>
            {/* Connection Status Banner */}
            <div className="w-full bg-white rounded-xl shadow-md overflow-hidden p-5 mb-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="font-medium">
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {isConnected 
                  ? `Connected to ${selectedNetwork?.name || 'Ethereum'} with address ${truncateAddress(address)}` 
                  : 'Connect your wallet to interact with the blockchain'}
              </p>
              
              {/* Disconnect Button - Always visible when connected */}
              {isConnected && (
                <button 
                  className="mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full"
                  onClick={() => {
                    disconnect();
                    toast.success('Wallet disconnected successfully');
                  }}
                >
                  Disconnect Wallet
                </button>
              )}
            </div>

            {/* Network Selection */}
            <div className="w-full bg-white rounded-xl shadow-md overflow-hidden p-5 mb-4">
              <h2 className="text-lg font-semibold mb-3 text-center">Select Network</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                {SUPPORTED_NETWORKS.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => handleNetworkChange(network)}
                    className={`p-3 rounded border ${
                      selectedNetwork.id === network.id
                        ? 'bg-blue-100 border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    } flex items-center justify-center transition-all`}
                    disabled={isSwitchingNetwork}
                    title={`Switch to ${network.name} network`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold text-gray-700">
                        {network.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{network.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              {isSwitchingNetwork && (
                <div className="text-center text-sm text-gray-500 flex items-center justify-center">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
                  Switching network...
                </div>
              )}
              <div className="text-center text-xs text-gray-500 mt-2">
                <p>Click on a network to switch. If the network is not in your wallet, we'll help you add it.</p>
              </div>
            </div>
            
            {isConnected ? (
              <div className="w-full">
                {isWrongNetwork ? (
                  <div className="mb-4 text-center">
                    <div className="bg-yellow-100 p-3 rounded-md text-yellow-700 mb-4">
                      You are connected to the wrong network. Please switch to {selectedNetwork.name}.
                    </div>
                    <button 
                      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
                      onClick={handleSwitchToCorrectNetwork}
                    >
                      Switch to {selectedNetwork.name}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 bg-white p-4 rounded-md shadow-md border border-gray-200">
                      <div className="mb-4 bg-green-100 p-3 rounded-md text-green-700 text-center">
                        Connected to {selectedNetwork.name} network
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-1">Thông tin mạng</p>
                        <div className="bg-gray-100 p-3 rounded text-sm">
                          <p><span className="font-medium">ID:</span> {selectedNetwork.id}</p>
                          <p><span className="font-medium">Đơn vị tiền tệ:</span> {selectedNetwork.nativeCurrency.symbol}</p>
                          <p>
                            <span className="font-medium">Block Explorer:</span> 
                            <a 
                              href={selectedNetwork.blockExplorer} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline ml-1"
                            >
                              {selectedNetwork.blockExplorer}
                            </a>
                          </p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-1">Địa chỉ Ví</p>
                        <div className="flex items-center justify-between relative">
                          <p className="font-mono bg-gray-100 p-2 rounded overflow-auto text-sm">
                            {truncateAddress(address)}
                          </p>
                          <button 
                            className="ml-2 text-blue-500 hover:text-blue-700 text-sm"
                            onClick={handleCopyAddress}
                            title="Copy to clipboard"
                          >
                            Sao chép
                          </button>
                          {showCopiedMessage && (
                            <div className="absolute right-0 -top-8 bg-gray-800 text-white text-xs py-1 px-2 rounded shadow-md">
                              Đã sao chép!
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-1">Số Dư Ví</p>
                        <p className="font-mono bg-gray-100 p-2 rounded">
                          {isBalanceLoading ? 
                            'Đang tải...' : 
                            `${balanceData?.formatted || '0'} ${balanceData?.symbol || 'ETH'}`
                          }
                        </p>
                      </div>
                      
                      {!showTransactionForm ? (
                        <div className="flex flex-col items-center mt-4 space-y-4">
                          <button 
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full"
                            onClick={() => setShowTransactionForm(true)}
                          >
                            Send Test Transaction
                          </button>
                          
                          <button 
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded w-full"
                            onClick={() => {
                              disconnect();
                              // Optional: Add a toast notification here
                              window.alert('Wallet disconnected successfully');
                            }}
                          >
                            Disconnect Wallet
                          </button>
                        </div>
                      ) : (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <h3 className="text-lg font-semibold mb-2">Gửi ETH Thử Nghiệm</h3>
                          
                          {/* Transaction Status Display */}
                          {getTransactionStatusMessage()}
                          
                          <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-1">Địa Chỉ Người Nhận</label>
                            <input 
                              type="text" 
                              value={recipientAddress}
                              onChange={(e) => setRecipientAddress(e.target.value)}
                              placeholder="0x..."
                              className="w-full p-2 border border-gray-300 rounded"
                              disabled={transactionStatus === 'pending'}
                            />
                          </div>
                          
                          <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-1">Số Lượng (ETH)</label>
                            <input 
                              type="number"
                              step="0.001"
                              min="0"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="0.01"
                              className="w-full p-2 border border-gray-300 rounded"
                              disabled={transactionStatus === 'pending'}
                            />
                          </div>
                          
                          <div className="flex space-x-2">
                            <button 
                              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded flex-1"
                              onClick={() => {
                                setShowTransactionForm(false);
                                setTransactionStatus('idle');
                                setTransactionHash(undefined);
                              }}
                              disabled={transactionStatus === 'pending' && !isConfirmed}
                            >
                              Hủy
                            </button>
                            <button 
                              className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex-1 ${
                                (isSendingTransaction || isConfirming) ? 'opacity-70 cursor-not-allowed' : ''
                              }`}
                              onClick={handleSendTransaction}
                              disabled={isSendingTransaction || isConfirming || !recipientAddress || !amount || transactionStatus === 'pending'}
                            >
                              {isSendingTransaction ? 'Đang gửi...' : isConfirming ? 'Đang xác nhận...' : 'Gửi'}
                            </button>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <button 
                              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded w-full"
                              onClick={() => {
                                disconnect();
                                // Optional: Add a toast notification here
                                window.alert('Wallet disconnected successfully');
                              }}
                            >
                              Disconnect Wallet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full">
                {!showWalletOptions ? (
                  <div className="bg-white p-6 rounded-md shadow-md border border-gray-200 mb-6 text-center">
                    <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                    <p className="mb-6 text-gray-600">
                      Connect your wallet to interact with blockchain networks and use the application features.
                    </p>
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded w-full max-w-xs mx-auto"
                      onClick={() => setShowWalletOptions(true)}
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-md shadow-md border border-gray-200 mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold">Chọn Ví</h2>
                      <button 
                        className="text-gray-500 hover:text-gray-700"
                        onClick={() => setShowWalletOptions(false)}
                      >
                        &times;
                      </button>
                    </div>
                    
                    {isClient && wallets.length > 0 ? (
                      <>
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold mb-2 text-left">Ví Đã Cài Đặt</h3>
                          <div className="space-y-2">
                            {wallets.filter(wallet => wallet.installed).length > 0 ? (
                              wallets.filter(wallet => wallet.installed).map(wallet => 
                                renderWalletItem(wallet, true)
                              )
                            ) : (
                              <p className="text-gray-500 py-2">Không tìm thấy ví nào đã cài đặt</p>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-semibold mb-2 text-left">Thêm Ví Khác</h3>
                          <div className="space-y-2">
                            {wallets.filter(wallet => !wallet.installed && wallet.id !== 'walletconnect').length > 0 ? (
                              wallets.filter(wallet => !wallet.installed && wallet.id !== 'walletconnect').map(wallet => 
                                renderWalletItem(wallet, false)
                              )
                            ) : (
                              <p className="text-gray-500 py-2">Không có ví được đề xuất</p>
                            )}
                            
                            {/* Always show WalletConnect */}
                            {wallets.find(wallet => wallet.id === 'walletconnect') && (
                              renderWalletItem(wallets.find(wallet => wallet.id === 'walletconnect')!, true)
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">Đang tải danh sách ví...</p>
                        <button 
                          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                          onClick={() => setIsClient(true)}
                        >
                          Tải Lại Danh Sách Ví
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </ClientOnly>
        </div>
      </main>
      
      <footer className="py-4 bg-white shadow-inner mt-12">
        <p className="text-center text-gray-600 text-sm">
          © 2023 PowAI. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default WalletConnect; 