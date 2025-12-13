import type {
  ClarityValue,
  GetAddressesResult,
  TransactionResult,
} from "@stacks/connect/dist/types/methods";
import "./App.css";
import { useEffect, useState } from "react";
import { request } from "@stacks/connect";
import { Cl, fetchCallReadOnlyFunction, Pc } from "@stacks/transactions";
import {
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
} from "@stacks/connect";

function App() {
  const [address, setAddress] = useState("");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [totalValue, setTotalValue] = useState<number | null>();

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

  async function addMessage() {
    try {
      setTxLoading(true);
      const result: TransactionResult = await request("stx_callContract", {
        contract: "SP1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXRCD0S3K.message-board",
        functionName: "increment",
        functionArgs: [],
        network: "mainnet",
        // postConditions: [postCond_1],
        postConditionMode: "deny",
        sponsored: false,
      });

      if (result && result?.txid) {
        setTxHash("0x" + result.txid);
      }

      console.log(result);
    } catch (err) {
      console.log(err);
    } finally {
      setTxLoading(false);
    }
  }

  async function getMessageCountAtBlock() {
    try {
      const result: ClarityValue = await fetchCallReadOnlyFunction({
        contractAddress: "SP1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXRCD0S3K",
        contractName: "message-board",
        functionName: "get-counter",
        functionArgs: [],
        network: "mainnet",
        senderAddress: address,
      });

      if (result) {
        // .value.toString()
        const value = parseInt(result?.value.toString());
        console.log(value);
        setTotalValue(value);
      }
    } catch (err) {
      console.log(err);
    }
  }

  useEffect(() => {
    if (address || txHash) {
      getMessageCountAtBlock();
    }
  }, [address, txHash]);

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

      {/* Main */}
      <main className="bg-amber-200/50 mt-4 w-1/3 mx-auto p-6 space-y-6">
        <div className="flex flex-col items-center justify-center">
          <h3 className="text-2xl font-semibold">Your Increment</h3>
          <p className="text-xl">{totalValue ? totalValue : "Loading..."}</p>
        </div>

        <button
          onClick={addMessage}
          className="w-full py-2 text-xl bg-amber-600 "
        >
          {txLoading ? "Pending..." : "Increment"}
        </button>

        {txHash && (
          <a
            target="_blank"
            className="text-blue-500 underline text-center mx-auto"
            href={`https://explorer.hiro.so/txid/${txHash}?chain=mainnet`}
          >
            Transaction Details
          </a>
        )}
      </main>
    </main>
  );
}

export default App;
