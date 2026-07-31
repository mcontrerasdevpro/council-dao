import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const Web3Context = createContext();

export const useWeb3 = () => useContext(Web3Context);

export const CFG = {
  rpc: "https://sepolia.base.org",
  registry: "0xba91BdcC80bDbe8a0aec5c3219a6C076E7358A5b",
  gateway: "https://ipfs.io",
  explorer: "https://basescan.org",
  chainId: 84532n
};

// CORREGIDO: Añadimos export aquí delante
export const SEL = {
  nextId: "0x61b8ce8c", fee: "0xddca3f43", base: "0x5001f3b5",
  safe: "0x186f0354", treasury: "0x61d027b3", proposals: "0x55ef20e6",
  getPage: "0xcd1a2e91", getThreshold: "0xe75235b8", getOwners: "0xa0e67e2b",
};

export const Web3Provider = ({ children }) => {
  const [wallet, setWallet] = useState({ signer: null, address: null, isOwner: false });
  const [council, setCouncil] = useState({ safe: null, threshold: null, ownerList: [] });
  const [errorMsg, setErrorMsg] = useState("");
  const [triggerRefresh, setTriggerRefresh] = useState(0);

  const wordAt = (raw, o) => BigInt("0x" + raw.substr(o * 2, 64));
  const addrAt = (raw, o) => "0x" + raw.substr(o * 2 + 24, 40);

  const ethCall = useCallback(async (to, data) => {
    const res = await fetch(CFG.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || "rpc error");
    return j.result;
  }, []);

  const refreshData = () => setTriggerRefresh(prev => prev + 1);

  const fetchCouncil = useCallback(async (safeAddr) => {
    try {
      const [thrHex, ownersHex] = await Promise.all([
        ethCall(safeAddr, SEL.getThreshold),
        ethCall(safeAddr, SEL.getOwners)
      ]);
      const threshold = Number(BigInt(thrHex));
      const raw = ownersHex.replace(/^0x/, "");
      const off = Number(wordAt(raw, 0));
      const len = Number(wordAt(raw, off));
      
      const list = [];
      for (let i = 0; i < len; i++) {
        list.push(addrAt(raw, off + 32 + i * 32).toLowerCase());
      }
      setCouncil({ safe: safeAddr, threshold, ownerList: list });
    } catch (e) {
      console.error("Error cargando concilio:", e);
    }
  }, [ethCall]);

  useEffect(() => {
    if (wallet.address && council.ownerList.length > 0) {
      const isOwner = council.ownerList.includes(wallet.address.toLowerCase());
      setWallet(prev => ({ ...prev, isOwner }));
    }
  }, [wallet.address, council.ownerList]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setErrorMsg("No hay wallet en el navegador (instala MetaMask o Rabby).");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const net = await provider.getNetwork();
      
      if (net.chainId !== CFG.chainId) {
        try {
          await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x14a34" }] });
        } catch {
          setErrorMsg("Cambia la red a Base Sepolia y vuelve a conectar.");
          return;
        }
      }
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setErrorMsg("");
      setWallet({ signer, address, isOwner: false });
    } catch (e) {
      setErrorMsg("No se pudo conectar: " + (e.shortMessage || e.message));
    }
  };

  const disconnectWallet = async () => {
    try { await window.ethereum?.request?.({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }); } catch {}
    setWallet({ signer: null, address: null, isOwner: false });
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on?.("accountsChanged", async (accs) => {
        if (!accs[0]) {
          setWallet({ signer: null, address: null, isOwner: false });
        } else {
          try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setWallet(prev => ({ ...prev, signer, address }));
          } catch {
            setWallet(prev => ({ ...prev, address: accs[0], signer: null }));
          }
        }
      });
      window.ethereum.on?.("chainChanged", () => window.location.reload());
    }
  }, []);

  return (
    <Web3Context.Provider value={{ CFG, SEL, wallet, council, errorMsg, setErrorMsg, ethCall, fetchCouncil, connectWallet, disconnectWallet, triggerRefresh, refreshData }}>
      {children}
    </Web3Context.Provider>
  );
};