import React from 'react';
import { useWeb3 } from '../../context/Web3Context';

export default function Masthead() {
  const { wallet, connectWallet, disconnectWallet } = useWeb3();
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

  return (
    <header className="masthead">
      <div className="mast-left">
        <div className="kicker">Democracia participativa · gobernanza on-chain</div>
        <h1 className="wordmark">Coun<span className="reg">c</span>il</h1>
        <p className="tagline">Registro público de ideas que el council de democracia participativa promueve a votación.</p>
      </div>
      <div className="mast-right">
        <span className="net">
          <span className={`tick ${wallet.address ? 'live' : ''}`}></span>Base Sepolia
        </span>
        <button 
          className={`btn ${wallet.address ? (wallet.isOwner ? 'owner' : 'notowner') : ''}`}
          onClick={wallet.address ? disconnectWallet : connectWallet}
          title={wallet.address ? "Click para desconectar" : ""}
        >
          {!wallet.address ? "Conectar wallet" : `${short(wallet.address)}${wallet.isOwner ? " · signer ✓" : " · no signer"}`}
        </button>
      </div>
    </header>
  );
}