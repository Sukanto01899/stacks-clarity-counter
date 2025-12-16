import type { GetAddressesResult } from "@stacks/connect/dist/types/methods";
import "./App.css";
import { useState } from "react";

import {
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
} from "@stacks/connect";

import SukantoContract from "./components/SukantoContract";
import NahianContract from "./components/NahianConract";
import RubelContract from "./components/RubelContract";
import TanbirNabilContract from "./components/TanvirNabilContract";
import MahiContract from "./components/MahiContract";
import NazroContract from "./components/NazroContract";
import { manageChainhooks } from "../lib/manageChainhooks";

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
    <main className="w-full">
      <button onClick={() => manageChainhooks}>Check Chainhook</button>
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
      <MahiContract address={address} />
      <TanbirNabilContract address={address} />
      <NazroContract address={address} />
    </main>
  );
}

export default App;
