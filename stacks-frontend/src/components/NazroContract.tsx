import type {
  ClarityValue,
  TransactionResult,
} from "@stacks/connect/dist/types/methods";

import { useEffect, useState } from "react";
import { request } from "@stacks/connect";
import { cvToValue, fetchCallReadOnlyFunction } from "@stacks/transactions";

function NazroContract({ address }: { address: string }) {
  const [txLoading, setTxLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [totalValue, setTotalValue] = useState<number | null>();

  async function addMessage() {
    try {
      setTxLoading(true);
      const result: TransactionResult = await request("stx_callContract", {
        contract: "SP2E7S861KY8HBXNNKW2DG771MAXMSNXAXWD5EGY.message-board",
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
        contractAddress: "SP2E7S861KY8HBXNNKW2DG771MAXMSNXAXWD5EGY",
        contractName: "message-board",
        functionName: "get-counter",
        functionArgs: [],
        network: "mainnet",
        senderAddress: address,
      });

      if (result) {
        // .value.toString()
        const value = Number(cvToValue(result));
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
    <main className="bg-amber-200/50 mt-4 w-1/3 mx-auto p-6 space-y-6">
      <div className="flex flex-col items-center justify-center">
        <h3 className="text-2xl font-semibold">Nazro Counter</h3>
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
  );
}

export default NazroContract;
