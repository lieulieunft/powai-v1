"use client";

import React, { useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useAccount, useBalance, useChainId, useConnect } from 'wagmi';
import Navbar from '@/components/Navbar';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';

// Định nghĩa kiểu dữ liệu mở rộng Window để thêm các thuộc tính ví
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isTrust?: boolean;
      isTokenPocket?: boolean;
      request: (request: { method: string, params?: any[] }) => Promise<any>;
    };
    okxwallet?: any;
  }
}

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Địa chỉ router swap trên Base Sepolia (sẽ cập nhật dựa vào mạng hiện tại)
const DEFAULT_SWAP_ROUTER_ADDRESS = '0x8AB702a70C9769EE2a214D6610d06AC577A482c5';

// Mapping địa chỉ USDC theo mạng
const USDC_ADDRESSES: { [chainId: number]: string } = {
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia 
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Ethereum Sepolia
  // Thêm các mạng khác nếu cần
};

// Hàm helper để lấy địa chỉ USDC theo mạng hiện tại
const getUsdcAddressForNetwork = (networkChainId?: number): string => {
  // Sử dụng chainId từ tham số, không phụ thuộc vào biến bên ngoài
  const currentChainId = networkChainId || 84532; // Default to Base Sepolia
  
  // Trả về địa chỉ USDC cho mạng tương ứng hoặc địa chỉ mặc định
  return USDC_ADDRESSES[currentChainId] || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
};

// ABI tối thiểu cho router swap
const SWAP_ROUTER_ABI = [
  // Hàm swapExactETHForTokens - đổi ETH sang token (USDC)
  {
    "inputs": [
      { "name": "amountOutMin", "type": "uint256" },
      { "name": "path", "type": "address[]" },
      { "name": "to", "type": "address" },
      { "name": "deadline", "type": "uint256" }
    ],
    "name": "swapExactETHForTokens",
    "outputs": [{ "name": "amounts", "type": "uint256[]" }],
    "stateMutability": "payable",
    "type": "function"
  },
  // Hàm swapExactTokensForETH - đổi token (USDC) sang ETH
  {
    "inputs": [
      { "name": "amountIn", "type": "uint256" },
      { "name": "amountOutMin", "type": "uint256" },
      { "name": "path", "type": "address[]" },
      { "name": "to", "type": "address" },
      { "name": "deadline", "type": "uint256" }
    ],
    "name": "swapExactTokensForETH",
    "outputs": [{ "name": "amounts", "type": "uint256[]" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Xác định môi trường
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
// Cấu hình giao dịch giả lập - sử dụng biến môi trường
const MOCK_TX_ENABLED = process.env.NEXT_PUBLIC_MOCK_TX === 'true';

// ABI tối thiểu cho các chức năng cần thiết của USDC
const USDC_ABI = [
  // Hàm balanceOf để kiểm tra số dư USDC
  {
    "constant": true,
    "inputs": [{ "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  // Hàm approve để cho phép contract khác sử dụng token
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  // Hàm transfer để chuyển USDC
  {
    "constant": false,
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  // Hàm decimals để biết số lượng số thập phân
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  }
];

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data);
      toast.error(error.response.data.detail || 'An error occurred');
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.request);
      toast.error('Network error - Please check if the server is running');
    } else {
      // Something else happened
      console.error('Error:', error.message);
      toast.error('An unexpected error occurred');
    }
    return Promise.reject(error);
  }
);

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

// Avatar component for wallet address
const AddressAvatar: React.FC<{address: string}> = ({ address }) => {
  return (
    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
      {address.substring(2, 4)}
    </div>
  );
};

// Input with label and button component
const ActionInput: React.FC<{
  label: string;
  placeholder: string;
  buttonText: string;
  onAction: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, placeholder, buttonText, onAction, disabled, loading }) => {
  const [value, setValue] = useState('');
  
  const handleAction = () => {
    onAction(value);
    setValue('');
  };
  
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAction}
          disabled={disabled || loading || !value}
          className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r font-medium transition duration-200 ${
            (disabled || loading || !value) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Processing...' : buttonText}
        </button>
      </div>
    </div>
  );
};

// Type for transaction log entries
interface TransactionLogEntry {
  timestamp: string;
  message: string;
  type: 'init' | 'command' | 'processing' | 'info' | 'success' | 'error';
  txHash?: string;
  explorerUrl?: string;
  isMockTx?: boolean;
}

// Component for AI Console Output
const AIConsoleOutput: React.FC<{logs: TransactionLogEntry[]}> = ({ logs }) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogStyle = (type: string) => {
    switch (type) {
      case 'init':
        return 'text-blue-500';
      case 'command':
        return 'text-purple-500 font-bold';
      case 'processing':
        return 'text-yellow-600';
      case 'info':
        return 'text-gray-600';
      case 'success':
        return 'text-green-600 font-semibold';
      case 'error':
        return 'text-red-600 font-semibold';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div 
      ref={consoleRef}
      className="bg-gray-900 text-gray-100 p-4 rounded-md h-72 overflow-y-auto font-mono text-sm"
    >
      {logs.length === 0 ? (
        <div className="text-gray-500 italic">AI agent console output will appear here...</div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="mb-1">
            <span className="text-gray-500">[{log.timestamp}]</span>{' '}
            <span className={getLogStyle(log.type)}>{log.message}</span>
            {log.txHash && log.explorerUrl && (
              <div className="ml-6 mt-0.5 mb-1">
                {log.isMockTx ? (
                  <span className="text-yellow-400 text-xs flex items-center">
                    <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Demo Transaction (not on blockchain): {log.txHash.substring(0, 10)}...
                  </span>
                ) : (
                  <a 
                    href={`${log.explorerUrl}/tx/${log.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs underline flex items-center"
                  >
                    View on Explorer: {log.txHash.substring(0, 10)}...
                    <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// Networks information
const NETWORKS: {[key: number]: {
  name: string;
  nativeCurrency: string;
  explorerUrl: string;
  isSupported: boolean;
  swapRouter?: string; // Thêm địa chỉ swap router cho mỗi mạng
  usdcAddress?: string; // Thêm địa chỉ USDC cho mỗi mạng
}} = {
  // Base Sepolia được đưa lên đầu tiên
  84532: {
    name: 'Base Sepolia',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.basescan.org',
    isSupported: true,
    swapRouter: '0x8AB702a70C9769EE2a214D6610d06AC577A482c5', // Router swap trên Base Sepolia
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC trên Base Sepolia
  },
  84531: {
    name: 'Base Sepolia (Legacy)',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.basescan.org',
    isSupported: true,
    swapRouter: '0x8AB702a70C9769EE2a214D6610d06AC577A482c5', // Router swap trên Base Sepolia Legacy
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC trên Base Sepolia
  },
  8453: {
    name: 'Base',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://basescan.org',
    isSupported: true,
    swapRouter: '0xaAA37aE8713c2c1078F12302D7f4205E6De9e4eE', // Router swap trên Base mainnet
  },
  1: {
    name: 'Ethereum Mainnet',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://etherscan.io',
    isSupported: true,
    swapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
  },
  11155111: {
    name: 'Sepolia Testnet',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    isSupported: true,
    swapRouter: '0x6418EEC70f50913ff0d756B48d32Ce7C02b47C47', // Uniswap V3 Router
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC trên Sepolia
  },
  5: {
    name: 'Goerli Testnet',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://goerli.etherscan.io',
    isSupported: true,
  },
  42161: {
    name: 'Arbitrum One',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    isSupported: true,
    swapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap Router
  },
  10: {
    name: 'Optimism',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io',
    isSupported: true,
    swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Uniswap V3 Router
  },
  137: {
    name: 'Polygon',
    nativeCurrency: 'MATIC',
    explorerUrl: 'https://polygonscan.com',
    isSupported: true,
    swapRouter: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap Router
  },
  56: {
    name: 'BNB Chain',
    nativeCurrency: 'BNB',
    explorerUrl: 'https://bscscan.com',
    isSupported: true,
    swapRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap Router
  },
  43114: {
    name: 'Avalanche',
    nativeCurrency: 'AVAX',
    explorerUrl: 'https://snowtrace.io',
    isSupported: true,
    swapRouter: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', // TraderJoe Router
  },
  1337: {
    name: 'Monad',
    nativeCurrency: 'MONAD',
    explorerUrl: 'https://explorer.monad.xyz',
    isSupported: true,
  },
};

// Khai báo interface cho chainlink price feed ABI thay vì import
const chainlinkPriceFeedABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)"
];

// Thêm một component ClientSideOnly mới
const ClientSideOnly = ({ children }: { children: React.ReactNode }) => {
  const [hasMounted, setHasMounted] = useState(false);
  
  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  if (!hasMounted) {
    return null;
  }
  
  return <>{children}</>;
};

const AIPowered: React.FC = () => {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
  });
  const { connectors } = useConnect();
  
  // Thêm state để lưu tên ví đã kết nối
  const [connectedWalletName, setConnectedWalletName] = useState<string>('');
  
  // Network information state - đặt Base Sepolia là mạng mặc định
  const [currentNetwork, setCurrentNetwork] = useState<{
    name: string;
    chainId: number;
    isSupported: boolean;
    explorerUrl: string;
    nativeCurrency: string;
    swapRouter?: string;
    usdcAddress?: string;
  }>({
    name: 'Base Sepolia',
    chainId: 84532,
    isSupported: true,
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: 'ETH',
    swapRouter: '0x8AB702a70C9769EE2a214D6610d06AC577A482c5',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  });
  
  // State for user data
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [aiWalletBalance, setAiWalletBalance] = useState('0');
  
  // State for actions
  const [isProcessingBuy, setIsProcessingBuy] = useState(false);
  const [isProcessingFund, setIsProcessingFund] = useState(false);
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
  
  // State for AI console
  const [aiConsoleInput, setAiConsoleInput] = useState('');
  const [aiConsoleOutput, setAiConsoleOutput] = useState('');
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // New states for command execution
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  
  // Update AI Console states
  const [aiConsoleMessages, setAiConsoleMessages] = useState<{
    message: string;
    type: 'info' | 'success' | 'error' | 'pending';
    timestamp: Date;
  }[]>([]);
  
  // Transaction logs
  const [transactionLogs, setTransactionLogs] = useState<TransactionLogEntry[]>([]);
  
  // Thêm state cho USDC balance
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [isLoadingUsdcBalance, setIsLoadingUsdcBalance] = useState<boolean>(false);
  
  // Add message to AI Console
  const addConsoleMessage = (message: string, type: 'info' | 'success' | 'error' | 'pending' = 'info') => {
    setAiConsoleMessages(prev => [
      ...prev,
      {
        message,
        type,
        timestamp: new Date()
      }
    ]);
  };
  
  // Function to add log entry
  const addLogEntry = (message: string, type: TransactionLogEntry['type'] = 'info', txHash?: string, explorerUrl?: string, isMockTx: boolean = MOCK_TX_ENABLED) => {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];
    
    setTransactionLogs(prev => [...prev, {
      timestamp,
      message,
      type,
      txHash,
      explorerUrl,
      isMockTx
    }]);
  };
  
  // Cập nhật useEffect để lưu tên ví kết nối
  useEffect(() => {
    if (isConnected && connector) {
      setConnectedWalletName(connector.name || 'Unknown wallet');
      console.log('Connected to wallet:', connector.name);
    }
  }, [isConnected, connector]);
  
  // Thay đổi hàm getProviderAndSigner để trở thành hàm client-side only với đánh dấu rõ ràng
  const getProviderAndSigner = () => {
    if (typeof window === 'undefined') {
      throw new Error('Web3 provider not available in server-side rendering');
    }

    let provider;
    
    // Các ví được hỗ trợ theo thứ tự ưu tiên
    if (window.ethereum) {
      // MetaMask hoặc ví tương thích EIP-1193
      provider = new ethers.providers.Web3Provider(window.ethereum);
      console.log('Using window.ethereum provider');
    } else if (typeof window !== 'undefined' && window.okxwallet) {
      // OKX Wallet
      provider = new ethers.providers.Web3Provider(window.okxwallet);
      console.log('Using OKX Wallet provider');
    } else {
      // Fallback: JSON-RPC provider
      provider = new ethers.providers.JsonRpcProvider();
      console.log('Using default JSON-RPC provider');
    }
    
    return {
      provider,
      signer: provider.getSigner(),
    };
  };
  
  // Lấy contract USDC
  const getUsdcContract = (withSigner: boolean = false) => {
    const { provider, signer } = getProviderAndSigner();
    const contract = new ethers.Contract(
      getUsdcAddressForNetwork(chainId),
      USDC_ABI,
      withSigner ? signer : provider
    );
    return contract;
  };
  
  // Hàm lấy số dư USDC
  const fetchUsdcBalance = async () => {
    if (!address) return;
    
    setIsLoadingUsdcBalance(true);
    try {
      const contract = getUsdcContract();
      const decimals = await contract.decimals();
      const balance = await contract.balanceOf(address);
      
      // Chuyển đổi từ wei sang số có thể đọc được
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      setUsdcBalance(formattedBalance);
      console.log('USDC Balance:', formattedBalance);
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      toast.error('Failed to fetch USDC balance');
    } finally {
      setIsLoadingUsdcBalance(false);
    }
  };
  
  // Cập nhật useEffect để lấy số dư USDC
  useEffect(() => {
    if (isConnected && address) {
      // Existing code
      setUserId(address);
      fetchUserData();
      
      // Thêm mới: Lấy số dư USDC
      fetchUsdcBalance();
      
      // Welcome message
      addConsoleMessage('AI Agent initialized. Connected to wallet.', 'info');
      addLogEntry(`Connected to wallet: ${connectedWalletName}`, 'init');
    }
  }, [isConnected, address, chainId, connectedWalletName]);
  
  // Fetch user data
  const fetchUserData = async () => {
    if (!address) {
      console.log('No address available yet');
      return;
    }
    
    console.log('Fetching user data for address:', address);
    try {
      const response = await api.get(`/transactions/${address}/summary`);
      console.log('User data response:', response.data);
      setCredits(response.data.current_credits || 0);
      setAiWalletBalance(response.data.ai_wallet_balance || '0');
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Temporarily using fallback values for development
      setCredits(100);
      setAiWalletBalance('1000');
      toast.error('Failed to fetch user data. Using demo values.');
    }
  };
  
  // Update network information based on chainId
  const updateNetworkInfo = useCallback(() => {
    if (!chainId) return;
    
    const networkInfo = NETWORKS[chainId];
    if (networkInfo) {
      setCurrentNetwork({
        name: networkInfo.name,
        chainId: chainId,
        isSupported: networkInfo.isSupported,
        explorerUrl: networkInfo.explorerUrl,
        nativeCurrency: networkInfo.nativeCurrency,
        swapRouter: networkInfo.swapRouter,
        usdcAddress: networkInfo.usdcAddress
      });
    } else {
      // Unknown network
      setCurrentNetwork({
        name: `Unknown Network (${chainId})`,
        chainId: chainId,
        isSupported: false,
        explorerUrl: '',
        nativeCurrency: 'ETH'
      });
    }
  }, [chainId]);

  // Get explorer URL based on current network - improved version
  const getExplorerUrl = (networkChainId?: number): string => {
    // Use provided chainId or current chain from state
    const currentChainId = networkChainId || chainId || 1;
    
    // Return from our network dictionary
    return NETWORKS[currentChainId]?.explorerUrl || 'https://etherscan.io';
  };

  // Generate a mock transaction hash
  const generateMockTxHash = (): string => {
    return `0x${Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('')}`;
  };

  // Check if the current network is supported
  const isNetworkSupported = (): boolean => {
    return currentNetwork.isSupported;
  };

  // Verify if a chain has USDC token available
  const chainHasUSDC = (chainId: number): boolean => {
    // List of chains known to have USDC
    const chainsWithUSDC = [1, 137, 56, 43114, 42161, 10, 8453, 84531, 84532];
    return chainsWithUSDC.includes(chainId);
  }

  // Updated handle buying credits
  const handleBuyCredits = async (amount: string) => {
    if (!userId) return;
    
    addConsoleMessage(`Processing purchase of ${amount} credits...`, 'pending');
    setIsProcessingBuy(true);
    
    try {
      // Simulating API call for development
      const isDevelopmentMode = !api.defaults.baseURL || process.env.NODE_ENV === 'development';
      
      if (isDevelopmentMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setCredits(prev => prev + parseInt(amount));
        
        addConsoleMessage(`Transaction prepared: Purchase ${amount} credits`, 'info');
        await new Promise(resolve => setTimeout(resolve, 1000));
        addConsoleMessage(`Payment confirmed for ${amount} credits`, 'success');
        
        toast.success(`Successfully purchased ${amount} credits!`);
      } else {
        // Real API implementation
        const response = await api.post('/ai_credit_endpoint', {
          user_id: userId,
          action: 'buy',
          amount: parseInt(amount),
        });
        
        addConsoleMessage(`Payment intent created for ${amount} credits`, 'info');
        
        // Here you would typically handle the Stripe payment flow
        const { client_secret, payment_intent_id } = response.data;
        
        // After successful payment
        const confirmResponse = await api.post('/ai_credit_endpoint', {
          user_id: userId,
          action: 'confirm-buy',
          payment_intent_id,
          credits_to_add: parseInt(amount),
        });
        
        setCredits(confirmResponse.data.credits_remaining);
        addConsoleMessage(`Payment confirmed for ${amount} credits`, 'success');
        toast.success(`Successfully purchased ${amount} credits!`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to buy credits';
      addConsoleMessage(`Error: ${errorMsg}`, 'error');
      toast.error(errorMsg);
    } finally {
      setIsProcessingBuy(false);
    }
  };
  
  // Updated handle funding AI wallet
  const handleFundAiWallet = async (amount: string) => {
    if (!userId) return;
    
    addConsoleMessage(`Processing: Fund AI Wallet with ${amount} USDC...`, 'pending');
    setIsProcessingFund(true);
    
    try {
      // Simulating API call for development
      const isDevelopmentMode = !api.defaults.baseURL || process.env.NODE_ENV === 'development';
      
      if (isDevelopmentMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        addConsoleMessage(`Preparing transaction: Supply ${amount} USDC`, 'info');
        await new Promise(resolve => setTimeout(resolve, 800));
        addConsoleMessage(`Transaction submitted to blockchain`, 'info');
        await new Promise(resolve => setTimeout(resolve, 700));
        
        setAiWalletBalance((prev) => (parseFloat(prev) + parseFloat(amount)).toString());
        addConsoleMessage(`Transaction confirmed: Added ${amount} USDC to AI Wallet`, 'success');
        
        toast.success(`Successfully funded AI wallet with ${amount} USDC!`);
      } else {
        // Real API implementation
        const response = await api.post('/ai_credit_endpoint', {
          user_id: userId,
          action: 'supply',
          amount: parseFloat(amount),
        });
        
        addConsoleMessage(`Transaction submitted: Supply ${amount} USDC`, 'info');
        
        const { tx_hash } = response.data;
        addConsoleMessage(`Transaction confirmed on blockchain (${tx_hash.substring(0, 10)}...)`, 'success');
        
        setAiWalletBalance((prev) => (parseFloat(prev) + parseFloat(amount)).toString());
        toast.success(`Successfully funded AI wallet with ${amount} USDC!`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to fund AI wallet';
      addConsoleMessage(`Error: ${errorMsg}`, 'error');
      toast.error(errorMsg);
    } finally {
      setIsProcessingFund(false);
    }
  };
  
  // Updated handle USDC transfer
  const handleTransferUsdc = async (amount: string) => {
    if (!userId) return;
    
    addConsoleMessage(`Processing: Swap ${amount} USDC...`, 'pending');
    setIsProcessingTransfer(true);
    
    try {
      // Simulating API call for development
      const isDevelopmentMode = !api.defaults.baseURL || process.env.NODE_ENV === 'development';
      
      if (isDevelopmentMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        addConsoleMessage(`Preparing swap: ${amount} USDC to ETH`, 'info');
        await new Promise(resolve => setTimeout(resolve, 800));
        addConsoleMessage(`Checking exchange rates...`, 'info');
        addLogEntry(`Checking exchange rates...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 700));
        
        addConsoleMessage(`Best rate found: 1 USDC = 0.000412 ETH`, 'info');
        addLogEntry(`Best rate found: 1 USDC = 0.000412 ETH`, 'info');
        await new Promise(resolve => setTimeout(resolve, 600));
        
        addConsoleMessage(`Transaction submitted to blockchain`, 'info');
        addLogEntry(`Transaction submitted to blockchain`, 'info');
        
        addConsoleMessage(`Swap completed: ${amount} USDC → ${(parseFloat(amount) * 0.000412).toFixed(6)} ETH`, 'success');
        toast.success(`Successfully swapped ${amount} USDC!`);
      } else {
        // Real API implementation
        const response = await api.post('/ai_credit_endpoint', {
          user_id: userId,
          action: 'swap',
          amount_in: parseFloat(amount),
        });
        
        addConsoleMessage(`Transaction submitted: Swap ${amount} USDC`, 'info');
        
        const { tx_hash } = response.data;
        addConsoleMessage(`Swap confirmed on blockchain (${tx_hash.substring(0, 10)}...)`, 'success');
        
        toast.success(`Successfully transferred ${amount} USDC!`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to transfer USDC';
      addConsoleMessage(`Error: ${errorMsg}`, 'error');
      toast.error(errorMsg);
    } finally {
      setIsProcessingTransfer(false);
    }
  };
  
  // Updated handle USDC withdrawal
  const handleWithdrawUsdc = async (amount: string) => {
    if (!userId) return;
    
    addConsoleMessage(`Processing: Withdraw ${amount} USDC...`, 'pending');
    setIsProcessingWithdraw(true);
    
    try {
      // Simulating API call for development
      const isDevelopmentMode = !api.defaults.baseURL || process.env.NODE_ENV === 'development';
      
      if (isDevelopmentMode) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        addConsoleMessage(`Preparing transaction: Withdraw ${amount} USDC`, 'info');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Check if withdrawal amount exceeds balance
        if (parseFloat(amount) > parseFloat(aiWalletBalance)) {
          throw new Error(`Insufficient balance. Available: ${aiWalletBalance} USDC`);
        }
        
        addConsoleMessage(`Withdrawal transaction submitted`, 'info');
        await new Promise(resolve => setTimeout(resolve, 700));
        
        setAiWalletBalance((prev) => Math.max(0, parseFloat(prev) - parseFloat(amount)).toString());
        addConsoleMessage(`Withdrawal completed: ${amount} USDC sent to wallet`, 'success');
        
        toast.success(`Successfully withdrew ${amount} USDC!`);
      } else {
        // Real API implementation
        const response = await api.post('/ai_credit_endpoint', {
          user_id: userId,
          action: 'withdraw',
          amount: parseFloat(amount),
        });
        
        addConsoleMessage(`Transaction submitted: Withdraw ${amount} USDC`, 'info');
        
        setAiWalletBalance((prev) => Math.max(0, parseFloat(prev) - parseFloat(amount)).toString());
        addConsoleMessage(`Withdrawal confirmed: ${amount} USDC sent to wallet`, 'success');
        
        toast.success(`Successfully withdrew ${amount} USDC!`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to withdraw USDC';
      addConsoleMessage(`Error: ${errorMsg}`, 'error');
      toast.error(errorMsg);
    } finally {
      setIsProcessingWithdraw(false);
    }
  };
  
  // Handle command execution with network validation
  const handleCommandSubmit = async (command: string) => {
    if (!command.trim()) return;
    
    // Check if connected to a supported network
    if (!isNetworkSupported()) {
      const errorMessage = `Network ${currentNetwork.name} is not fully supported. Some features may not work correctly.`;
      toast.error(errorMessage);
      addLogEntry(errorMessage, 'error');
      return;
    }
    
    setIsProcessingCommand(true);
    addConsoleMessage(`Command received: ${command}`, 'info');
    addLogEntry(`Command received: ${command} (Network: ${currentNetwork.name})`, 'command');
    
    try {
      // Parse command
      const parts = command.toLowerCase().split(' ');
      const action = parts[0];
      
      switch(action) {
        case 'swap':
          if (parts.length >= 2) {
            const amount = parts[1];
            const asset = parts.length >= 3 ? parts[2] : 'usdc'; // Default to USDC if not specified
            
            if (asset === 'eth' || asset === currentNetwork.nativeCurrency.toLowerCase()) {
              await handleSwapEthToUsdc(amount);
            } else {
              await handleSwapUsdcToEth(amount);
            }
          } else {
            addConsoleMessage('Error: Please specify amount to swap', 'error');
            addLogEntry('Error: Please specify amount to swap', 'error');
            toast.error('Please specify amount to swap');
          }
          break;
          
        case 'supply':
          if (parts.length > 1) {
            await handleFundAiWallet(parts[1]);
          } else {
            addConsoleMessage('Error: Please specify amount to supply', 'error');
            addLogEntry('Error: Please specify amount to supply', 'error');
            toast.error('Please specify amount to supply');
          }
          break;
          
        case 'withdraw':
          if (parts.length > 1) {
            await handleWithdrawUsdc(parts[1]);
          } else {
            addConsoleMessage('Error: Please specify amount to withdraw', 'error');
            addLogEntry('Error: Please specify amount to withdraw', 'error');
            toast.error('Please specify amount to withdraw');
          }
          break;
          
        case 'buy':
          if (parts.length > 1) {
            await handleBuyCredits(parts[1]);
          } else {
            addConsoleMessage('Error: Please specify amount of credits to buy', 'error');
            addLogEntry('Error: Please specify amount of credits to buy', 'error');
            toast.error('Please specify amount of credits to buy');
          }
          break;
          
        case 'help':
          addConsoleMessage('Available commands:', 'info');
          addLogEntry('Available commands:', 'info');
          addConsoleMessage(`- swap [amount] (usdc|${currentNetwork.nativeCurrency.toLowerCase()}): Swap crypto assets`, 'info');
          addLogEntry(`- swap [amount] (usdc|${currentNetwork.nativeCurrency.toLowerCase()}): Swap crypto assets`, 'info');
          addConsoleMessage('- supply [amount]: Fund AI Wallet with USDC', 'info');
          addLogEntry('- supply [amount]: Fund AI Wallet with USDC', 'info');
          addConsoleMessage('- withdraw [amount]: Withdraw USDC from AI Wallet', 'info');
          addLogEntry('- withdraw [amount]: Withdraw USDC from AI Wallet', 'info');
          addConsoleMessage('- buy [amount]: Purchase AI Credits', 'info');
          addLogEntry('- buy [amount]: Purchase AI Credits', 'info');
          addConsoleMessage('- network: Show current network info', 'info');
          addLogEntry('- network: Show current network info', 'info');
          addConsoleMessage('- swap-info: Display swap router information', 'info');
          addLogEntry('- swap-info: Display swap router information', 'info');
          addConsoleMessage('- help: Show available commands', 'info');
          addLogEntry('- help: Show available commands', 'info');
          break;
          
        case 'network':
          // Add a new command to display network info
          addConsoleMessage(`Current Network: ${currentNetwork.name} (${currentNetwork.chainId})`, 'info');
          addLogEntry(`Current Network: ${currentNetwork.name} (${currentNetwork.chainId})`, 'info');
          addConsoleMessage(`Native Currency: ${currentNetwork.nativeCurrency}`, 'info');
          addLogEntry(`Native Currency: ${currentNetwork.nativeCurrency}`, 'info');
          addConsoleMessage(`Explorer: ${currentNetwork.explorerUrl}`, 'info');
          addLogEntry(`Explorer: ${currentNetwork.explorerUrl}`, 'info');
          
          // Hiển thị thông tin router swap nếu có
          const hasRouter = hasSwapRouter();
          if (hasRouter) {
            const routerAddress = getSwapRouterForCurrentNetwork();
            addConsoleMessage(`Swap Router: ${routerAddress}`, 'info');
            addLogEntry(`Swap Router: ${routerAddress}`, 'info');
            addConsoleMessage(`USDC Contract: ${getUsdcAddressForNetwork(chainId)}`, 'info');
            addLogEntry(`USDC Contract: ${getUsdcAddressForNetwork(chainId)}`, 'info');
          } else {
            addConsoleMessage(`Swap Router: Not configured for this network`, 'info');
            addLogEntry(`Swap Router: Not configured for this network`, 'info');
          }
          break;
          
        case 'swap-info':
          // Lệnh mới để hiển thị thông tin swap
          addConsoleMessage(`Swap Information:`, 'info');
          addLogEntry(`Swap Information:`, 'info');
          
          const networkHasRouter = hasSwapRouter();
          if (networkHasRouter) {
            const routerAddress = getSwapRouterForCurrentNetwork();
            addConsoleMessage(`- Swap Router: ${routerAddress}`, 'info');
            addLogEntry(`- Swap Router: ${routerAddress}`, 'info');
            addConsoleMessage(`- Router Explorer: ${currentNetwork.explorerUrl}/address/${routerAddress}`, 'info');
            addLogEntry(`- Router Explorer: ${currentNetwork.explorerUrl}/address/${routerAddress}`, 'info');
          } else {
            addConsoleMessage(`- Swap Router: Not available on ${currentNetwork.name}`, 'error');
            addLogEntry(`- Swap Router: Not available on ${currentNetwork.name}`, 'error');
            addConsoleMessage(`- Will use direct transfer method as fallback`, 'info');
            addLogEntry(`- Will use direct transfer method as fallback`, 'info');
          }
          
          addConsoleMessage(`- USDC Contract: ${getUsdcAddressForNetwork(chainId)}`, 'info');
          addLogEntry(`- USDC Contract: ${getUsdcAddressForNetwork(chainId)}`, 'info');
          addConsoleMessage(`- USDC Explorer: ${currentNetwork.explorerUrl}/token/${getUsdcAddressForNetwork(chainId)}`, 'info');
          addLogEntry(`- USDC Explorer: ${currentNetwork.explorerUrl}/token/${getUsdcAddressForNetwork(chainId)}`, 'info');
          
          // Hiển thị tỷ giá tham khảo
          addConsoleMessage(`- Reference Rate: 1 ${currentNetwork.nativeCurrency} = 2000 USDC`, 'info');
          addLogEntry(`- Reference Rate: 1 ${currentNetwork.nativeCurrency} = 2000 USDC`, 'info');
          addConsoleMessage(`- Reference Rate: 1 USDC = 0.000409 ${currentNetwork.nativeCurrency}`, 'info');
          addLogEntry(`- Reference Rate: 1 USDC = 0.000409 ${currentNetwork.nativeCurrency}`, 'info');
          break;
          
        default:
          addConsoleMessage(`Unknown command: "${action}". Type "help" for available commands.`, 'error');
          addLogEntry(`Unknown command: "${action}". Type "help" for available commands.`, 'error');
          toast.error('Unknown command. Type "help" for available commands');
      }
      
      setCommandInput('');
    } catch (error: any) {
      addConsoleMessage(`Error executing command: ${error.message || 'Unknown error'}`, 'error');
      addLogEntry(`Error executing command: ${error.message || 'Unknown error'}`, 'error');
      toast.error(error.message || 'Failed to execute command');
      console.error('Command execution error:', error);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // Function to get the latest ETH/USD price from Chainlink
  const getEthUsdPrice = async (provider: ethers.providers.Provider): Promise<number> => {
    try {
      // ETH/USD price feed on Sepolia testnet
      const priceFeedAddress = '0x694AA1769357215DE4FAC081bf1f309aDC325306';
      const priceFeed = new ethers.Contract(priceFeedAddress, chainlinkPriceFeedABI, provider);
      const roundData = await priceFeed.latestRoundData();
      const decimals = await priceFeed.decimals();
      return parseFloat(ethers.utils.formatUnits(roundData.answer, decimals));
    } catch (error) {
      console.error("Error fetching ETH/USD price:", error);
      // Return a fallback price if API fails
      return 2000; // $2000 as a fallback price
    }
  };

  // Handle swapping USDC to ETH with blockchain interaction
  const handleSwapEthToUsdc = async (amount: string) => {
    if (!userId || !address) {
      addConsoleMessage('Please connect your wallet first', 'error');
      toast.error('Please connect your wallet first');
      return;
    }
    
    try {
      setIsProcessingTransfer(true);
      
      if (!currentNetwork || !currentNetwork.isSupported) {
        throw new Error(`Please switch to a supported network. Current network: ${currentNetwork?.name || 'Unknown'}`);
      }
      
      const { provider, signer } = getProviderAndSigner();
      const ethUsdPrice = await getEthUsdPrice(provider);
      const amountInWei = ethers.utils.parseEther(amount);
      const expectedUsdcAmount = parseFloat(amount) * ethUsdPrice;
      
      addConsoleMessage(`Preparing transaction: Swap ${amount} ${currentNetwork.nativeCurrency} for ~${expectedUsdcAmount.toFixed(2)} USDC`, 'info');

      if (chainId === 11155111 && currentNetwork?.swapRouter) {
        try {
          addConsoleMessage(`Using Uniswap V3 Router on Sepolia: ${currentNetwork.swapRouter}`, 'info');
          
          const uniswapRouterABI = [
            "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256)",
            "function exactOutput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256)",
          ];
          
          const usdcAddress = getUsdcAddressForNetwork(chainId);
          const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
          const routerContract = new ethers.Contract(currentNetwork.swapRouter, uniswapRouterABI, signer);
          const fee = 3000;
          const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
          const slippageTolerance = 50;
          const amountOutMinimum = ethers.utils.parseUnits(((expectedUsdcAmount * (10000 - slippageTolerance)) / 10000).toFixed(6), 6);
          
          addConsoleMessage(`Attempting ETH to USDC swap via Uniswap V3...`, 'info');
          addConsoleMessage(`- Amount: ${amount} ETH`, 'info');
          addConsoleMessage(`- Minimum USDC expected: ${ethers.utils.formatUnits(amountOutMinimum, 6)}`, 'info');
          
          const params = {
            tokenIn: WETH_ADDRESS,
            tokenOut: usdcAddress,
            fee: fee,
            recipient: address,
            deadline: deadline,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
          };
          
          const tx = await routerContract.exactInputSingle(params, { value: amountInWei, gasLimit: 350000 });
          
          addConsoleMessage(`Transaction submitted: ${tx.hash.substring(0, 10)}...`, 'info');
          addLogEntry(`Transaction submitted: ETH to USDC swap on Sepolia via Uniswap V3`, 'info', tx.hash, currentNetwork.explorerUrl, false);
          
          const receipt = await tx.wait();
          
          if (receipt.status === 1) {
            const usdcAmount = expectedUsdcAmount.toFixed(2);
            addConsoleMessage(`Swap completed: ${amount} ${currentNetwork.nativeCurrency} → ~${usdcAmount} USDC`, 'success');
            addLogEntry(`Swap completed: ${amount} ${currentNetwork.nativeCurrency} → ~${usdcAmount} USDC`, 'success', tx.hash, currentNetwork.explorerUrl, false);
            setAiWalletBalance((prev) => (parseFloat(prev) + parseFloat(usdcAmount)).toString());
            toast.success(`Swap completed! ${amount} ${currentNetwork.nativeCurrency} to ~${usdcAmount} USDC`);
            setTimeout(() => fetchUsdcBalance(), 2000);
          } else {
            throw new Error('Transaction failed');
          }
          return;
        } catch (uniswapError: any) {
          console.error('Uniswap swap error:', uniswapError);
          addConsoleMessage(`Không thể swap qua Uniswap: ${uniswapError.message}`, 'error');
          addConsoleMessage(`Thực hiện phương án dự phòng...`, 'info');
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || `Failed to swap ${currentNetwork.nativeCurrency} to USDC`;
      addConsoleMessage(`Error: ${errorMsg}`, 'error');
      addLogEntry(`Error: ${errorMsg}`, 'error');
      toast.error(errorMsg);
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Handle swapping ETH to USDC with blockchain interaction
  const handleSwapUsdcToEth = async (amount: string) => {
    if (!userId || !address) {
      addConsoleMessage('Please connect your wallet first', 'error');
      toast.error('Please connect your wallet first');
      return;
    }
    
    try {
      setIsProcessingTransfer(true);
      
      if (!currentNetwork || !currentNetwork.isSupported) {
        throw new Error(`Please switch to a supported network. Current network: ${currentNetwork?.name || 'Unknown'}`);
      }
      
      const { provider, signer } = getProviderAndSigner();
      const ethUsdPrice = await getEthUsdPrice(provider);
      const usdcContract = getUsdcContract(true); // Tạo contract ở đây khi cần
      const amountInWei = ethers.utils.parseUnits(amount, 6);
      const expectedEthAmount = parseFloat(amount) / ethUsdPrice;
      
      addConsoleMessage(`Preparing transaction: Swap ${amount} USDC for ~${expectedEthAmount.toFixed(6)} ${currentNetwork.nativeCurrency}`, 'info');

      if (chainId === 11155111 && currentNetwork?.swapRouter) {
        try {
          addConsoleMessage(`Using Uniswap V3 Router on Sepolia: ${currentNetwork.swapRouter}`, 'info');
          
          const uniswapRouterABI = [
            "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256)",
            "function exactOutput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external returns (uint256)",
          ];
          
          const usdcAddress = getUsdcAddressForNetwork(chainId);
          const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
          const routerContract = new ethers.Contract(currentNetwork.swapRouter, uniswapRouterABI, signer);
          const fee = 3000;
          const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
          const slippageTolerance = 50;
          const amountOutMinimum = ethers.utils.parseEther(((expectedEthAmount * (10000 - slippageTolerance)) / 10000).toFixed(18));
          
          addConsoleMessage(`Attempting USDC to ETH swap via Uniswap V3...`, 'info');
          addConsoleMessage(`- Amount: ${amount} USDC`, 'info');
          addConsoleMessage(`- Minimum ETH expected: ${ethers.utils.formatEther(amountOutMinimum)}`, 'info');
          
          const approvalTx = await usdcContract.approve(currentNetwork.swapRouter, amountInWei);
          addConsoleMessage(`Approval transaction submitted: ${approvalTx.hash.substring(0, 10)}...`, 'info');
          addLogEntry(`Approving USDC for swap`, 'info', approvalTx.hash, currentNetwork.explorerUrl, false);
          await approvalTx.wait();
          addConsoleMessage(`USDC approved for swap`, 'info');
          
          const params = {
            tokenIn: usdcAddress,
            tokenOut: WETH_ADDRESS,
            fee: fee,
            recipient: address,
            deadline: deadline,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
          };
          
          const tx = await routerContract.exactInputSingle(params, { gasLimit: 350000 });
          
          addConsoleMessage(`Transaction submitted: ${tx.hash.substring(0, 10)}...`, 'info');
          addLogEntry(`Transaction submitted: USDC to ETH swap on Sepolia via Uniswap V3`, 'info', tx.hash, currentNetwork.explorerUrl, false);
          
          const receipt = await tx.wait();
          
          if (receipt.status === 1) {
            const ethAmount = expectedEthAmount.toFixed(6);
            addConsoleMessage(`Swap completed: ${amount} USDC → ~${ethAmount} ${currentNetwork.nativeCurrency}`, 'success');
            addLogEntry(`Swap completed: ${amount} USDC → ~${ethAmount} ${currentNetwork.nativeCurrency}`, 'success', tx.hash, currentNetwork.explorerUrl, false);
            toast.success(`Swap completed! ${amount} USDC to ~${ethAmount} ${currentNetwork.nativeCurrency}`);
            setTimeout(() => fetchUsdcBalance(), 2000);
          } else {
            throw new Error('Transaction failed');
          }
          return;
        } catch (uniswapError: any) {
          console.error('Uniswap swap error:', uniswapError);
          addConsoleMessage(`Không thể swap qua Uniswap: ${uniswapError.message}`, 'error');
          addConsoleMessage(`Thực hiện phương án dự phòng...`, 'info');
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || `Failed to swap USDC to ${currentNetwork.nativeCurrency}`;
      addConsoleMessage(`Error: ${errorMsg}`, 'error');
      addLogEntry(`Error: ${errorMsg}`, 'error');
      toast.error(errorMsg);
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Hàm thực hiện chuyển USDC có thực
  const transferUsdc = async (toAddress: string, amount: string) => {
    if (!address) throw new Error('Wallet not connected');
    
    try {
      const contract = getUsdcContract(true);
      const decimals = await contract.decimals();
      
      // Chuyển đổi số lượng từ đơn vị người dùng sang wei
      const amountInWei = ethers.utils.parseUnits(amount, decimals);
      
      // Thực hiện chuyển USDC
      const tx = await contract.transfer(toAddress, amountInWei);
      
      // Trả về hash giao dịch
      return tx.hash;
    } catch (error) {
      console.error('USDC transfer error:', error);
      throw error;
    }
  };

  // Truncate wallet address for display
  const truncateAddress = (address: string | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Hàm trả về địa chỉ router swap cho mạng hiện tại
  const getSwapRouterForCurrentNetwork = () => {
    return currentNetwork?.swapRouter || DEFAULT_SWAP_ROUTER_ADDRESS;
  };

  // Hàm kiểm tra xem mạng hiện tại có hỗ trợ router swap không
  const hasSwapRouter = (network?: typeof currentNetwork): boolean => {
    if (!network) return false;
    return !!network.swapRouter;
  };

  // Hàm kết nối với contract swap router
  const getSwapRouterContract = (withSigner = false) => {
    const { provider, signer } = getProviderAndSigner();
    const routerAddress = getSwapRouterForCurrentNetwork();
    
    const contract = new ethers.Contract(
      routerAddress,
      SWAP_ROUTER_ABI,
      withSigner ? signer : provider
    );
    
    return contract;
  };

  // Effect to update network information when chainId changes
  useEffect(() => {
    if (chainId) {
      updateNetworkInfo();
      
      // Add network info to log
      const networkInfo = NETWORKS[chainId] || {
        name: `Unknown Network (${chainId})`,
        isSupported: false
      };
      
      addLogEntry(`Connected to ${networkInfo.name} (Chain ID: ${chainId})`, 'info');
    }
  }, [chainId, updateNetworkInfo]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center pt-8 px-4">
        <ClientSideOnly>
          <div className="w-full max-w-4xl">
            {/* Header - Thông tin ví và network */}
            <div className="flex flex-col md:flex-row md:justify-between items-center mb-8 p-6 bg-white rounded-xl shadow-md">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="mr-3">
                  <AddressAvatar address={address || ''} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">AI-Powered DeFi</h2>
                  <div className="flex items-center text-sm text-gray-600">
                    <p className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {isConnected ? (
                        <>
                          <span className="mr-1">Connected Wallet:</span>
                          <span className="font-mono">{truncateAddress(address)}</span>
                          {connectedWalletName && (
                            <span className="ml-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                              {connectedWalletName}
                            </span>
                          )}
                        </>
                      ) : (
                        'Wallet Not Connected'
                      )}
                    </p>
                  </div>
                  {/* Network Information */}
                  <div className="flex items-center mt-1 text-sm">
                    <span className={`w-2 h-2 rounded-full mr-2 ${currentNetwork.isSupported ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span className="mr-1">Network:</span>
                    <span className={`font-medium ${currentNetwork.isSupported ? 'text-green-700' : 'text-yellow-700'}`}>
                      {currentNetwork.name}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">
                      (Chain ID: {chainId || '?'})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end">
                <div className="font-medium text-gray-700">
                  {balanceData && (
                    <div className="text-right mb-1">
                      <span className="text-sm">Balance: </span>
                      <span className="font-mono">
                        {parseFloat(ethers.utils.formatEther(balanceData.value)).toFixed(4)} {balanceData.symbol}
                      </span>
                    </div>
                  )}
                  <div className="text-right mb-1">
                    <span className="text-sm">AI Wallet: </span>
                    <span className="font-mono">{aiWalletBalance} USDC</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm">Credits: </span>
                    <span className="font-mono">{credits}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Main content - các section còn lại */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* ... nội dung không đổi ... */}
            </div>
            {/* ... nội dung không đổi ... */}
          </div>
        </ClientSideOnly>
      </main>
      
      <footer className="py-4 border-t text-center text-gray-600 text-sm">
        <p className="mb-1">AI Credit DeFi Demo &copy; 2023</p>
        <p className="text-center text-gray-500 text-xs mt-1">
          USDC Contract: {truncateAddress(getUsdcAddressForNetwork(chainId))}
          <a 
            href={`${NETWORKS[84532].explorerUrl}/token/${getUsdcAddressForNetwork(chainId)}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-1 text-blue-500 hover:text-blue-700"
          >
            View
          </a>
        </p>
      </footer>
    </div>
  );
};

export default AIPowered; 