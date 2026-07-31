import React, { useState, useEffect } from "react";
import { short, resolveCalldata, SAFE_ABI } from "../../hooks/cryptoUtils.js"; 
import { useWeb3, CFG } from "../../context/Web3Context.jsx";
import { ethers } from "ethers";

export default function IdeaCard({ idea, queued, onSelect }) {
  const { council } = useWeb3();
  const [content, setContent] = useState(null);
  const [title, setTitle] = useState("Cargando…");
  const [badgeData, setBadgeData] = useState({ text: "", className: "sig-badge" });

  useEffect(() => {
    let isMounted = true;
    
    const fetchFromIPFS = async () => {
      if (!idea.cid) {
        setTitle(`Propuesta #${idea.id} (Sin CID)`);
        return;
      }
      
      // Limpiamos cualquier rastro de protocolo antiguo del hash CID
      const path = idea.cid.replace(/^ipfs:\/\//, "").replace(/^\//, "");
      
      // Forzamos los dominios limpios de las pasarelas
      const gateways = [
        "https://ipfs.io",
        "https://dweb.link",
        "https://pinata.cloud"
      ];
      
      let success = false;
      for (const gw of gateways) {
        try {
          // Unimos forzando de forma explícita la barra / de separación en medio
          const cleanUrl = `${gw}/${path}`;
          
          const r = await fetch(cleanUrl, { signal: AbortSignal.timeout(2000) });
          if (!r.ok) continue;
          const json = await r.json();
          if (isMounted) {
            setContent(json);
            setTitle(json.title || `Propuesta #${idea.id} · ${short(idea.cid)}`);
            success = true;
            break;
          }
        } catch { /** Salta a la siguiente pasarela si da error o timeout **/ }
      }

      // Si las pasarelas fallan, usamos el plan de rescate para desbloquear el panel lateral
      if (!success && isMounted) {
        setTitle(`Propuesta #${idea.id} · ${short(idea.cid)}`);
      }
    };

    fetchFromIPFS();
    return () => { isMounted = false; };
  }, [idea.cid, idea.id]);

  useEffect(() => {
    if (idea.status !== 0 || !content || !council.ownerList.length) return;

    const readSignatures = async () => {
      try {
        const roProvider = new ethers.JsonRpcProvider(CFG.rpc);
        const safeContract = new ethers.Contract(council.safe, SAFE_ABI, roProvider);
        const nonce = await safeContract.nonce();
        
        const dataA = resolveCalldata(idea, content, true);
        const dataR = resolveCalldata(idea, content, false);
        
        const hashA = await safeContract.getTransactionHash(CFG.registry, 0, dataA, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, nonce);
        const hashR = await safeContract.getTransactionHash(CFG.registry, 0, dataR, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, nonce);

        let countA = 0, countR = 0;
        for (const owner of council.ownerList) {
          if ((await safeContract.approvedHashes(owner, hashA)) > 0n) countA++;
          if ((await safeContract.approvedHashes(owner, hashR)) > 0n) countR++;
        }

        const isApproveLead = countA >= countR;
        const finalCount = isApproveLead ? countA : countR;
        const type = isApproveLead ? "approve" : "reject";

        setBadgeData({
          text: `${finalCount}/${council.threshold}`,
          className: `sig-badge ${finalCount === 0 ? "neutral" : type} ${finalCount >= council.threshold ? "ready" : ""}`
        });
      } catch (e) {
        console.error("Error al leer firmas:", e);
      }
    };

    readSignatures();
  }, [content, council, idea]);

  return (
    <div className={`card ${queued ? "queued" : ""}`} onClick={() => onSelect({ idea, content })}>
      <div className="t">
        <span className="tx">{title}</span>
        {queued ? (
          <span className="lock">En cola</span>
        ) : (
          badgeData.text && <span className={badgeData.className}>{badgeData.text}</span>
        )}
        <span className="arw">→</span>
      </div>
    </div>
  );
}