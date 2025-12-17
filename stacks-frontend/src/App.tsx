import type { GetAddressesResult } from "@stacks/connect/dist/types/methods";
import "./App.css";
import { useState } from "react";

import {
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
} from "@stacks/connect";

import Header from "./components/Header";
import DailyCheckinCard from "./components/DailyChecking";
import BitcoinStampMint from "./components/BitcoinStampMint ";

function App() {
  const [address, setAddress] = useState(() => {
    const userData = getLocalStorage();
    return userData?.addresses?.stx?.[0]?.address ?? "";
  });
  const isWalletConnected = Boolean(address);

  async function connectWallet() {
    if (isConnected()) {
      console.log("Already authenticated");
      return;
    }

    const response: GetAddressesResult = await connect();
    if (response) {
      setAddress(response.addresses[2].address);
    }
  }
  function logout() {
    disconnect();
    setAddress("");
    console.log("User disconnected");
  }

  return (
    <main className="w-full bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <Header
        isWalletConnected={isWalletConnected}
        address={address}
        logout={logout}
        connectWallet={connectWallet}
      />

      <div className="min-h-screen  grid grid-cols-1 md:grid-cols-2 p-4 md:w-3/4 mx-auto gap-6">
        <DailyCheckinCard
          userAddress={address}
          setUserAddress={setAddress}
          connectWallet={connectWallet}
        />

        <BitcoinStampMint
          userAddress={address}
          setUserAddress={setAddress}
          connectWallet={connectWallet}
        />
      </div>
    </main>
  );
}

export default App;
