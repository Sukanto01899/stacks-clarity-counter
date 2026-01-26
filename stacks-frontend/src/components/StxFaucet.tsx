import { useEffect, useMemo, useState } from "react";

type FaucetStatus = {
  enabled: boolean;
  network: "testnet" | "mainnet";
  address: string;
  amountStx: string;
  cooldownMinutes: number;
};

type FaucetResponse = {
  txId: string;
  amountStx: string;
  cooldownMinutes: number;
  nextEligibleAt: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function getApiBaseUrl(): string {
  if (!API_BASE_URL) return "";
  return API_BASE_URL.replace(/\/$/, "");
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleString();
}

const StxFaucet = ({
  userAddress,
  connectWallet,
}: {
  userAddress: string;
  connectWallet: () => void;
}) => {
  const [status, setStatus] = useState<FaucetStatus | null>(null);
  const [addressInput, setAddressInput] = useState(userAddress);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txId, setTxId] = useState("");
  const [nextEligibleAt, setNextEligibleAt] = useState<number | null>(null);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  useEffect(() => {
    setAddressInput(userAddress);
  }, [userAddress]);

  useEffect(() => {
    const loadStatus = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/faucet/status`);
        if (!response.ok) return;
        const data = (await response.json()) as FaucetStatus;
        setStatus(data);
      } catch {
        // ignore status failures
      }
    };

    loadStatus();
  }, [apiBaseUrl]);

  const handleConnect = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      await connectWallet();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (): Promise<void> => {
    setError("");
    setSuccess("");
    setTxId("");
    setNextEligibleAt(null);

    const address = addressInput.trim();
    if (!address) {
      setError("Please enter a Stacks address.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/faucet/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = (await response.json()) as
        | FaucetResponse
        | { error?: string; nextEligibleAt?: number; message?: string };

      if (!response.ok) {
        setError(data.error ?? data.message ?? "Faucet request failed.");
        if (data.nextEligibleAt) setNextEligibleAt(data.nextEligibleAt);
        return;
      }

      const result = data as FaucetResponse;
      setTxId(result.txId);
      setSuccess(`Sent ${result.amountStx} STX. Transaction pending.`);
      setNextEligibleAt(result.nextEligibleAt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">STX Faucet</h1>
              <p className="text-slate-200 text-sm">
                Request test STX for gas and minting.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!userAddress ? (
            <div className="text-center py-6">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-600 mb-6 text-sm">
                Connect a Stacks wallet or paste an address below.
              </p>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-900 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600 mb-1">Connected Address</p>
              <p className="text-sm font-mono text-gray-900 truncate">
                {userAddress}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="STX address"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
            />
          </div>

          {status && (
            <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm text-slate-700">
              <div className="flex justify-between">
                <span>Network</span>
                <span className="font-semibold">{status.network}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span>Amount</span>
                <span className="font-semibold">{status.amountStx} STX</span>
              </div>
              <div className="flex justify-between mt-2">
                <span>Cooldown</span>
                <span className="font-semibold">
                  {status.cooldownMinutes} min
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-start">
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
              <p className="text-sm">{success}</p>
              {txId && (
                <p className="text-xs mt-2 font-mono break-all">{txId}</p>
              )}
            </div>
          )}

          {nextEligibleAt && (
            <div className="text-xs text-gray-500 mb-4">
              Next eligible at: {formatDateTime(nextEligibleAt)}
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={loading || (status ? !status.enabled : false)}
            className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
              !loading && (status ? status.enabled : true)
                ? "bg-slate-800 text-white hover:bg-slate-900 shadow-lg"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {loading ? "Requesting..." : "Request STX"}
          </button>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          Faucet notes
        </h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>Use testnet STX only for development.</li>
          <li>Cooldown applies per address and IP.</li>
          <li>Transactions may take a few minutes to confirm.</li>
        </ul>
      </div>
    </div>
  );
};

export default StxFaucet;
