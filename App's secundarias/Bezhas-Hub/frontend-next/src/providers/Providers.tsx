"use client";

import React, { ReactNode } from "react";
import Web3ModalProvider from "./Web3ModalProvider";
import { Web3Provider } from "../context/Web3Context";
import { BezPayProvider } from "../context/BezPayContext";
import BuyBezModal from "../components/economy/BuyBezModal";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Web3ModalProvider>
      <Web3Provider>
        <BezPayProvider>
          {children}
          <BuyBezModal />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#0C1628', color: '#E8F4FF', border: '1px solid #163560' },
              success: { iconTheme: { primary: '#00C896', secondary: '#0C1628' } },
              error:   { iconTheme: { primary: '#EF4444', secondary: '#0C1628' } },
            }}
          />
        </BezPayProvider>
      </Web3Provider>
    </Web3ModalProvider>
  );
}
