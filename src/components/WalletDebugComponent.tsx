import React from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";
import { useTonConnect } from "@/hooks/useTonConnect";

export const WalletDebugComponent = () => {
  const { 
    isConnected, 
    walletAddress, 
    connect, 
    disconnect, 
    wallet, 
    connectionState, 
    telegramUser, 
    isTelegramWallet 
  } = useTonConnect();


  return (
    <div className="w-full max-w-md space-y-4">
      {/* Connection Status */}
      {!isConnected ? (
        <Button 
          variant="default" 
          onClick={connect}
          className="w-full"
          disabled={connectionState === 'connecting' || !telegramUser.isAvailable}
        >
          <Wallet className="mr-2 h-4 w-4" />
          {connectionState === 'connecting' ? 'Connecting...' : 'Connect TON Space Wallet'}
        </Button>
      ) : (
        <div className="space-y-3">
          {/* Wallet Status Card */}
          <div className={`p-4 rounded-lg border ${isTelegramWallet ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            <div className="flex items-center mb-2">
              <div className={`w-2 h-2 rounded-full mr-2 ${isTelegramWallet ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              <p className={`text-sm font-medium ${isTelegramWallet ? 'text-green-800' : 'text-orange-800'}`}>
                {isTelegramWallet ? 'Telegram Wallet Connected' : 'External Wallet Connected'}
              </p>
            </div>
            
            <p className={`text-xs mb-1 ${isTelegramWallet ? 'text-green-700' : 'text-orange-700'}`}>
              Wallet Address:
            </p>
            <p className={`text-xs font-mono break-all p-2 rounded ${isTelegramWallet ? 'text-green-800 bg-green-100' : 'text-orange-800 bg-orange-100'}`}>
              {walletAddress}
            </p>
            
            {/* Warning for non-Telegram wallets */}
            {!isTelegramWallet && (
              <div className="mt-3 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-700">
                  <p className="font-medium">⚠️ This wallet may not be your Telegram TON Space!</p>
                  <p>Please ensure you're connecting through Telegram's built-in wallet for payments to work correctly.</p>
                </div>
              </div>
            )}
            
            {/* Success message for Telegram wallet */}
            {isTelegramWallet && (
              <div className="mt-3 flex items-start space-x-2">
                <div className="w-4 h-4 rounded-full bg-green-500 mt-0.5 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                </div>
                <div className="text-xs text-green-700">
                  <p className="font-medium">✅ Telegram TON Space wallet connected!</p>
                  <p>Your wallet is properly connected and ready for payments.</p>
                </div>
              </div>
            )}
          </div>

          {/* Debug Information */}
          <details className="text-xs bg-gray-50 p-3 rounded border">
            <summary className="cursor-pointer font-bold mb-2">🔍 Debug Information</summary>
            <div className="space-y-1 text-gray-700">
              <div><strong>Provider:</strong> {wallet?.provider || 'unknown'}</div>
              <div><strong>App Name:</strong> {wallet?.device?.appName || 'unknown'}</div>
              <div><strong>Platform:</strong> {wallet?.device?.platform || 'unknown'}</div>
              <div><strong>Device:</strong> {JSON.stringify(wallet?.device) || 'unknown'}</div>
              <div><strong>Telegram Available:</strong> {telegramUser.isAvailable ? 'Yes' : 'No'}</div>
              <div><strong>Telegram User ID:</strong> {telegramUser.id || 'Not found'}</div>
              <div><strong>Connection State:</strong> {connectionState}</div>
              <div><strong>Raw Address:</strong> {wallet?.account?.address || 'Not available'}</div>
              <div><strong>Is Telegram Wallet:</strong> {isTelegramWallet ? 'Yes' : 'No'}</div>
            </div>
          </details>

          {/* Disconnect Button */}
          <Button 
            variant="destructive" 
            size="sm"
            onClick={disconnect}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect Wallet
          </Button>
        </div>
      )}
    </div>
  );
};