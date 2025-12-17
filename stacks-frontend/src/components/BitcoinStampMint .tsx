import React, { useState, useEffect } from "react";
import { openContractCall } from "@stacks/connect";
import {
  cvToValue,
  fetchCallReadOnlyFunction,
  stringAsciiCV,
  PostConditionMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

const BitcoinStampMint = ({
  userAddress,
  connectWallet,
}: {
  userAddress: string;
  setUserAddress: (val: string) => void;
  connectWallet: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [totalSupply, setTotalSupply] = useState(0);
  const [maxSupply, setMaxSupply] = useState(0);
  const [mintEnabled, setMintEnabled] = useState(false);
  const [baseUri, setBaseUri] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mintCount, setMintCount] = useState(0);

  const CONTRACT_ADDRESS = "ST1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXVPSAX13";
  const CONTRACT_NAME = "bitcoin-stamp";
  const network = STACKS_TESTNET;

  const loadContractData = async () => {
    try {
      setLoading(true);
      setError("");

      const [supplyRes, maxRes, enabledRes, uriRes] = await Promise.all([
        fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-total-supply",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
        fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-max-supply",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
        fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "is-mint-enabled",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
        fetchCallReadOnlyFunction({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: "get-base-uri",
          functionArgs: [],
          network,
          senderAddress: CONTRACT_ADDRESS,
        }),
      ]);

      setTotalSupply(Number(cvToValue(supplyRes).value));
      setMaxSupply(Number(cvToValue(maxRes).value));
      setMintEnabled(cvToValue(enabledRes).value === true);
      setBaseUri(cvToValue(uriRes).value);
    } catch (err) {
      console.error("Error loading contract data:", err);
      setError("Failed to load contract data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContractData();
  }, []);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError("");

      await connectWallet();

      setSuccess("Wallet connected successfully!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("Connection error:", err);
      setError("Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  function getErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (typeof error === "object" && error !== null && "message" in error) {
      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === "string") return maybeMessage;
    }
    return undefined;
  }

  const handleFreeMint = async () => {
    if (!userAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!mintEnabled) {
      setError("Minting is currently disabled");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // Auto-generate name and URI
      const nextTokenId = totalSupply + 1;
      const autoName = `Bitcoin Stamp #${nextTokenId}`;
      const autoUri = `${baseUri}${nextTokenId}`;

      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "free-mint",
        functionArgs: [stringAsciiCV(autoName), stringAsciiCV(autoUri)],
        postConditionMode: PostConditionMode.Allow,
        network,
        onFinish: (data) => {
          console.log("Transaction:", data);
          setSuccess(`FREE NFT minted! ${autoName} 🎉`);
          setMintCount((prev) => prev + 1);

          setTimeout(async () => {
            await loadContractData();
            setSuccess("");
          }, 3000);
        },
        onCancel: () => {
          setError("Transaction cancelled by user");
          setLoading(false);
        },
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error) ?? "";

      if (message?.includes("410")) {
        setError("Max supply reached!");
      } else if (message?.includes("413")) {
        setError("Invalid input");
      } else if (message?.includes("401")) {
        setError("Not authorized or minting disabled");
      } else {
        setError(message || "Failed to mint NFT");
      }
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage =
    maxSupply > 0 ? (totalSupply / maxSupply) * 100 : 0;

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">Bitcoin Stamp NFT</h1>
              <p className="text-purple-100 text-sm">
                Free unlimited minting on Stacks blockchain
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!userAddress ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-purple-600"
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
                Connect your Stacks wallet to start minting FREE NFTs
              </p>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          ) : (
            <>
              {/* Connected Address */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-600 mb-1">Connected Address</p>
                <p className="text-sm font-mono text-gray-900 truncate">
                  {userAddress}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {totalSupply}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Total Minted</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {maxSupply}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Max Supply</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {mintCount}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">You Minted</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Minting Progress</span>
                  <span>{progressPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  {maxSupply - totalSupply} NFTs remaining
                </div>
              </div>

              {/* Status Badge */}
              <div className="mb-6">
                {mintEnabled ? (
                  <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-4 py-3">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-semibold">
                      🎁 FREE Minting Open - Unlimited Per Wallet!
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 bg-red-50 rounded-lg px-4 py-3">
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-semibold">
                      Minting is currently disabled
                    </span>
                  </div>
                )}
              </div>

              {/* Auto-generated Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">
                      Auto-Generated Metadata
                    </p>
                    <p className="text-xs">
                      Next NFT:{" "}
                      <strong>Bitcoin Stamp #{totalSupply + 1}</strong>
                    </p>
                    <p className="text-xs">
                      URI:{" "}
                      <strong>
                        {baseUri}
                        {totalSupply + 1}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-start">
                  <svg
                    className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-start">
                  <svg
                    className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm">{success}</span>
                </div>
              )}

              {/* Mint Button */}
              <button
                onClick={handleFreeMint}
                disabled={!mintEnabled || loading || totalSupply >= maxSupply}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  mintEnabled && !loading && totalSupply < maxSupply
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-3"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Minting...
                  </span>
                ) : totalSupply >= maxSupply ? (
                  "🚫 Max Supply Reached"
                ) : !mintEnabled ? (
                  "⏸️ Minting Disabled"
                ) : (
                  "🎁 Mint FREE NFT - No Cost!"
                )}
              </button>

              {/* Refresh Button */}
              <button
                onClick={loadContractData}
                disabled={loading}
                className="w-full mt-3 py-2 text-purple-600 hover:text-purple-700 disabled:text-gray-400 font-semibold text-sm transition-colors"
              >
                🔄 Refresh Data
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          About Bitcoin Stamp NFTs:
        </h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>
            • 🎁 <strong>100% FREE</strong> - No minting fees, ever!
          </li>
          <li>
            • ♾️ <strong>UNLIMITED</strong> - Mint as many as you want
          </li>
          <li>
            • 🤖 <strong>AUTO-GENERATED</strong> - Name and URI set
            automatically
          </li>
          <li>• Limited total supply of {maxSupply.toLocaleString()} NFTs</li>
          <li>• Permanently recorded on Stacks blockchain</li>
          <li>• Each NFT is unique with sequential numbering</li>
        </ul>
      </div>
    </div>
  );
};

export default BitcoinStampMint;
