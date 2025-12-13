import type { GetAddressesResult } from "@stacks/connect/dist/types/methods";
import "./App.css";
import { useEffect, useState } from "react";

import {
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
} from "@stacks/connect";

import SukantoContract from "./components/SukantoContract";
import NahianContract from "./components/NahianConract";
import RubelContract from "./components/RubelContract";

function App() {
  const [address, setAddress] = useState("");
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  useEffect(() => {
    const userData = getLocalStorage();
    if (userData?.addresses) {
      const stxAddress = userData.addresses.stx[0].address;
      setAddress(stxAddress);
      setIsWalletConnected(true);
    }
  }, []);

  async function connectWallet() {
    if (isConnected()) {
      console.log("Already authenticated");
      return;
    }

    const response: GetAddressesResult = await connect();
    if (response) {
      setAddress(response.addresses[2].address);
      setIsWalletConnected(true);
    }
  }
  function logout() {
    disconnect();
    setAddress("");
    setIsWalletConnected(false);
    console.log("User disconnected");
  }

  return (
    <main className="w-full">
      {/* Header */}
      <header className="bg-stone-950 text-white">
        <div className="w-2/3 mx-auto">
          <div className="flex justify-between items-center  px-16 py-4">
            <p className="text-xl font-bold">Stacks dev</p>
            <div>
              {isWalletConnected ? (
                address && (
                  <div className="flex items-center gap-4">
                    <p className="border border-amber-600 p-2">
                      {address.slice(0, 5)}...
                      {address.slice(address.length - 5, address.length)}
                    </p>

                    <button onClick={logout} className="bg-red-500 py-2 px-2">
                      Logout
                    </button>
                  </div>
                )
              ) : (
                <button
                  onClick={connectWallet}
                  className="bg-amber-600 px-4 py-2"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <SukantoContract address={address} />
      <NahianContract address={address} />
      <RubelContract address={address} />
    </main>
  );
}

export default App;
