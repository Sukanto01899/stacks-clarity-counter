import { useEffect, useState } from "react";
import { openContractCall } from "@stacks/connect";
import type { FinishedTxData } from "@stacks/connect";
import {
  cvToValue,
  fetchCallReadOnlyFunction,
  standardPrincipalCV,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

interface UserData {
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return undefined;
}

const DailyCheckinCard = ({
  userAddress,
  connectWallet,
}: {
  userAddress: string;
  setUserAddress: (val: string) => void;
  connectWallet: () => void;
}) => {
  // State management with proper types
  const [loading, setLoading] = useState<boolean>(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [canCheckin, setCanCheckin] = useState<boolean>(false);
  const [blocksRemaining, setBlocksRemaining] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const CONTRACT_ADDRESS = "ST1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXVPSAX13";
  const CONTRACT_NAME = "daily-gm";
  const network = STACKS_TESTNET;

  // Load user data from contract
  const loadUserData = async (address: string): Promise<void> => {
    if (!address) return;

    try {
      setLoading(true);
      setError("");

      // Get user data
      const userDataResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "get-user-data",
        functionArgs: [standardPrincipalCV(address)],
        network,
        senderAddress: address,
      });

      // Get can-check-in status
      const canCheckinResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "can-check-in",
        functionArgs: [standardPrincipalCV(address)],
        network,
        senderAddress: address,
      });

      // Get blocks remaining
      const blocksResult = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "blocks-until-next-checkin",
        functionArgs: [standardPrincipalCV(address)],
        network,
        senderAddress: address,
      });

      // Parse user data
      const userDataValue = cvToValue(userDataResult);
      // console.log(userDataValue);
      if (userDataValue && userDataValue.value) {
        const data = userDataValue.value.value;

        setUserData({
          totalCheckins: Number(cvToValue(data["total-checkins"]) || 0),
          currentStreak: Number(cvToValue(data["current-streak"]) || 0),
          longestStreak: Number(cvToValue(data["longest-streak"]) || 0),
        });
      } else {
        // New user
        setUserData({
          totalCheckins: 0,
          currentStreak: 0,
          longestStreak: 0,
        });
      }

      // Parse can check-in
      const canCheckinValue = cvToValue(canCheckinResult);
      if (canCheckinValue && canCheckinValue.value !== undefined) {
        setCanCheckin(canCheckinValue.value === true);
      } else {
        setCanCheckin(true);
      }

      // Parse blocks remaining
      const blocksValue = cvToValue(blocksResult);
      if (blocksValue && blocksValue.value !== undefined) {
        setBlocksRemaining(Number(blocksValue.value));
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load check-in data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Connect wallet (mock for demo - replace with actual wallet connection)
  const handleConnect = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      await connectWallet();
      await loadUserData(userAddress);

      setSuccess("Wallet connected successfully!");
    } catch (error: unknown) {
      console.error("Connection error:", error);
      setError(getErrorMessage(error) ?? "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  // Handle check-in
  const handleCheckin = async (): Promise<void> => {
    if (!userAddress || !canCheckin) return;

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "check-in",
        functionArgs: [],
        network,
        onFinish: (data: FinishedTxData) => {
          console.log("Transaction:", data);
          setSuccess("Check-in successful!");

          // Reload data after success
          setTimeout(async () => {
            await loadUserData(userAddress);
            setSuccess("");
          }, 3000);
        },
        onCancel: () => {
          setError("Transaction cancelled by user");
          setLoading(false);
        },
      });
    } catch (error: unknown) {
      console.error("Check-in error:", error);
      const message = getErrorMessage(error) ?? "";

      if (message.includes("100")) {
        setError("Already checked in today! Come back tomorrow.");
      } else if (message.includes("rejected")) {
        setError("Transaction cancelled by user");
      } else {
        setError(message || "Failed to check in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (blocks: number): string => {
    if (blocks === 0) return "Ready now!";
    const hours = Math.floor((blocks * 10) / 60);
    const minutes = Math.floor((blocks * 10) % 60);
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    if (userAddress) {
      loadUserData(userAddress);
    }
  }, [userAddress]);

  return (
    <div className="w-full max-w-md">
      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold mb-1">Daily Check-in</h1>
              <p className="text-orange-100 text-sm">
                Build your streak on Stacks!
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!userAddress ? (
            // Connect Wallet State
            <div className="text-center py-8">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-orange-500"
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
                Connect your Stacks wallet to start checking in daily
              </p>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
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
              {userData && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {userData.currentStreak}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Current Streak
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {userData.longestStreak}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Longest Streak
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {userData.totalCheckins}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Total Check-ins
                    </div>
                  </div>
                </div>
              )}

              {/* Check-in Status */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                {canCheckin ? (
                  <div className="flex items-center text-green-600">
                    <svg
                      className="w-5 h-5 mr-2 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-semibold">Ready to check in!</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center text-orange-600 mb-2">
                      <svg
                        className="w-5 h-5 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-semibold">Next check-in in:</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 ml-7">
                      {formatTimeRemaining(blocksRemaining)}
                    </div>
                    <div className="text-xs text-gray-500 ml-7 mt-1">
                      ({blocksRemaining} blocks remaining)
                    </div>
                  </div>
                )}
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

              {/* Check-in Button */}
              <button
                onClick={handleCheckin}
                disabled={!canCheckin || loading}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                  canCheckin && !loading
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl"
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
                    Processing...
                  </span>
                ) : canCheckin ? (
                  "âœ“ Check In Now"
                ) : (
                  "â° Come Back Later"
                )}
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => loadUserData(userAddress)}
                disabled={loading}
                className="w-full mt-3 py-2 text-orange-600 hover:text-orange-700 disabled:text-gray-400 font-semibold text-sm transition-colors"
              >
                Refresh Data
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">
          How it works:
        </h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>â€¢ Check in once every 24 hours (144 blocks)</li>
          <li>â€¢ Build your streak by checking in consecutively</li>
          <li>â€¢ Miss 2+ days and your streak resets</li>
          <li>â€¢ Your longest streak is saved forever</li>
        </ul>
      </div>
    </div>
  );
};

export default DailyCheckinCard;
