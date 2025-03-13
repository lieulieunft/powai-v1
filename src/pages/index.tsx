"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface UserLogin {
  email: string;
  password: string;
}

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

const Home: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<UserLogin>();
  const router = useRouter();

  const onSubmit = async (data: UserLogin) => {
    try {
      const response = await client.post('/auth/login', data);
      if (response.status === 200) {
        toast.success('Login successful!');
      } else {
        toast.error(response.data.detail);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <ClientOnly>
          <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-6">
            <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">PowAI</h1>
            <p className="text-gray-600 mb-6 text-center">Smart financial services powered by AI</p>
            
            <form onSubmit={handleSubmit(onSubmit)} className="w-full">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  {...register("email", { required: "Email is required" })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  {...register("password", { required: "Password is required" })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-medium transition duration-200"
              >
                Login
              </button>
            </form>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-center text-gray-600 mb-3">Or access with cryptocurrency wallet</p>
              <button 
                onClick={() => router.push('/wallet-connect')}
                className="w-full flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 px-4 rounded font-medium transition duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.586l-1.707-1.707A1 1 0 0012 2h-4a1 1 0 00-.707.293L5.586 4H4zm10 2a1 1 0 011 1v10a1 1 0 01-1 1h-1a1 1 0 01-1-1V7a1 1 0 011-1h1z"></path>
                </svg>
                Connect Wallet
              </button>
            </div>
          </div>
        </ClientOnly>
      </main>
      
      <footer className="py-4 bg-white shadow-inner">
        <p className="text-center text-gray-600 text-sm">
          © 2023 PowAI. All rights reserved.
        </p>
      </footer>
      
      <Toaster />
    </div>
  );
};

export default Home;

interface UserLogin {
  email: string;
  password: string;
}

const UserLoginForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<UserLogin>();

  const onSubmit = async (data: UserLogin) => {
    try {
      const response = await client.post('/auth/login', data);
      console.log(response.data);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm">
      <div className="mb-4">
        <label className="block text-sm font-bold mb-2" htmlFor="email">
          Email
        </label>
        <input
          type="email"
          id="email"
          {...register("email", { required: "Email is required" })}
          className="input input-bordered w-full"
        />
        {errors.email && <p className="text-red-500">{errors.email.message}</p>}
      </div>
      <div className="mb-4">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type="password"
          id="password"
          {...register("password", { required: "Password is required" })}
          className="input input-bordered w-full max-w-sm"
        />
        {errors.password && <p className="text-red-500">{errors.password.message}</p>}
      </div>
      <div>
        <button type="submit" className="btn btn-primary w-full">
          Đăng nhập
        </button>
      </div>
    </form>
  );
} 