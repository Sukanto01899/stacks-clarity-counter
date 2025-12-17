type HeaderProps = {
  isWalletConnected: boolean;
  address: string;
  logout: () => void;
  connectWallet: () => void;
};

const Header = ({
  isWalletConnected,
  address,
  logout,
  connectWallet,
}: HeaderProps) => {
  return (
    <header className="bg-stone-950 text-white">
      <div className="w-full mx-auto px-4 py-4 lg:px-12">
        <div className="flex justify-between items-center ">
          <p className="text-xl font-bold">Stamp</p>
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
  );
};

export default Header;
