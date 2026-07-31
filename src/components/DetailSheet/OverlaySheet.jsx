import React, { useState, useEffect, useCallback } from "react";
import { short, formatEther, resolveCalldata, SAFE_ABI } from "../../hooks/cryptoUtils.js";
import { useWeb3, CFG } from "../../context/Web3Context.jsx";
import { ethers } from "ethers";

export const OverlaySheet = ({ active, onClose }) => {
  const { idea, content } = active;
  const { short, formatEther, resolveCalldata, SAFE_ABI } = useCryptoUtils();
  const { wallet, council } = useWeb3();
  const [progressMsg, setProgressMsg] = useState("");
  const [quorumData, setQuorumData] = useState(null);
  const [progress, setProgress] = useState({ loading: true, approve: {}, reject: {}, threshold: 0 });
  const [guard, setGuard] = useState({ signedApprove: false, signedReject: false, checked: false });

  const variants = content?.acceptedOptions?.[0]?.variants || [];
  const question = content?.acceptedOptions?.[0]?.title || "";
  const hasVoting = !!(content && typeof content.voting === "object" && content.voting);
  const gwUrl = CFG.gateway + (idea.cid || "").replace(/^ipfs:\/\//, "");

  const esc = (s) => (s == null ? "" : String(s));

  const refreshProgress = useCallback(async () => {
    if (!content || idea.status !== 0) return;
    setProgress(p => ({ ...p, loading: true }));
    try {
      const ro = new ethers.JsonRpcProvider(CFG.rpc);
      const safe = new ethers.Contract(council.safe, SAFE_ABI, ro);
      const nonce = await safe.nonce();

      const dataA = resolveCalldata(idea, content, true);
      const dataR = resolveCalldata(idea, content, false);

      const hA = await safe.getTransactionHash(CFG.registry, 0, dataA, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, nonce);
      const hR = await safe.getTransactionHash(CFG.registry, 0, dataR, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, nonce);

      let cA = 0, cR = 0;
      for (const o of council.ownerList) {
        const [vA, vR] = await Promise.all([safe.approvedHashes(o, hA), safe.approvedHashes(o, hR)]);
        if (vA > 0n) cA++;
        if (vR > 0n) cR++;
      }

      setQuorumData({ hA, hR, cA, cR, dataA, dataR, nonce });
      setProgress({
        loading: false,
        threshold: council.threshold,
        approve: { hash: hA, data: dataA, count: cA },
        reject: { hash: hR, data: dataR, count: cR }
      });

      if (wallet.address) {
        const [uA, uR] = await Promise.all([
          safe.approvedHashes(wallet.address, hA),
          safe.approvedHashes(wallet.address, hR)
        ]);
        setGuard({ signedApprove: uA > 0n, signedReject: uR > 0n, checked: true });
      }
    } catch (e) {
      setProgressMsg(`Error de lectura: ${e.message}`);
      setProgress(p => ({ ...p, loading: false }));
    }
  }, [content, idea, council, wallet.address, resolveCalldata, SAFE_ABI]);

  useEffect(() => {
    refreshProgress();
  }, [active, council, refreshProgress]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSign = async (approve) => {
    if (!wallet.signer || !wallet.isOwner || !quorumData) return;
    setProgressMsg("Enviando firma a la red...");
    try {
      const safe = new ethers.Contract(council.safe, SAFE_ABI, wallet.signer);
      const targetData = approve ? quorumData.dataA : quorumData.dataR;
      const hash = await safe.getTransactionHash(CFG.registry, 0, targetData, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, quorumData.nonce);

      const tx = await safe.approveHash(hash);
      setProgressMsg(`Transacción enviada: ${short(tx.hash)}. Esperando bloque...`);
      await tx.wait();
      setProgressMsg("");
      refreshProgress();
    } catch (e) {
      setProgressMsg(`Error al firmar: ${e.message}`);
    }
  };

  const handleExecute = async (approve) => {
    if (!quorumData) return;
    try {
      setProgressMsg("Componiendo firmas ordenadas e indexando...");
      const roSafe = new ethers.Contract(council.safe, SAFE_ABI, new ethers.JsonRpcProvider(CFG.rpc));
      const targetData = approve ? quorumData.dataA : quorumData.dataR;
      const hash = approve ? quorumData.hA : quorumData.hR;

      const approvers = [];
      for (const o of council.ownerList) {
        if ((await roSafe.approvedHashes(o, hash)) > 0n) approvers.push(o);
      }

      const sorted = [...approvers].sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : 1)).slice(0, council.threshold);
      let sigs = "0x";
      for (const o of sorted) sigs += ethers.zeroPadValue(o, 32).slice(2) + "0".repeat(64) + "01";

      setProgressMsg("Ejecutando lote multi-sig...");
      const safe = new ethers.Contract(council.safe, SAFE_ABI, wallet.signer);
      const tx = await safe.execTransaction(CFG.registry, 0, targetData, 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, sigs);
      await tx.wait();
      setProgressMsg("✓ ¡Ejecutado con éxito!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setProgressMsg(`Error en ejecución: ${e.message}`);
    }
  };

  const handleAnonymousVote = () => {
    if (typeof Worker !== "undefined") {
      // Inicializamos el Worker apuntando a nuestro script criptográfico
      const worker = new Worker(new URL("../../hooks/zkpWorker.js", import.meta.url));

      // Escuchamos las señales asíncronas de la prueba biométrica
      worker.onmessage = (event) => {
        const { status, message, proof, publicSignals } = event.data;

        if (status === "PROCESSING" || status === "GENERATING") {
          console.log("🛠️ ZKP Status:", message); // Aquí actualizarías un estado local 'loadingMsg'
        }
        if (status === "SUCCESS") {
          console.log("✅ ¡Prueba ZKP Generada de forma anónima!", proof, publicSignals);
          // Aquí lanzarías la transacción de voto encriptado al contrato de Votaciones
          worker.terminate(); // Cerramos el hilo para liberar memoria RAM
        }
        if (status === "ERROR") {
          console.error("❌ Error criptográfico:", event.data.error);
          worker.terminate();
        }
      };

      // Lanzamos la acción enviando los parámetros biométricos simulados
      worker.postMessage({
        action: "GENERATE_PROOF",
        passportData: { nullifierHash: "0xabc..." }
      });
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-top">
          <span className={`d-status s${idea.status}`}>
            {idea.status === 0 ? "Pendiente" : idea.status === 1 ? "Aprobada" : "Rechazada"}
          </span>
          <button className="sheet-close" onClick={onClose}>Cerrar ✕</button>
        </div>

        <h2 className="d-title">{content?.title || `Idea ${short(idea.cid)}`}</h2>
        {content?.description && <p className="d-desc">{content.description}</p>}

        {idea._content && !hasVoting && (
          <div className="d-warn">Le faltan los <b>parámetros de votación</b>. No puede promoverse a votación tal cual.</div>
        )}

        {variants.length > 0 && (
          <div className="d-sec">
            <div className="d-lab">Papeleta Verificada Biométrica</div>
            {question && <div className="d-question">{question}</div>}
            <ul className="d-variants">{variants.map((v, i) => <li key={i}>{v}</li>)}</ul>
          </div>
        )}

        <div className="d-sec">
          <div className="d-lab">En la cadena de bloques</div>
          <div className="d-kv"><span className="k">CID</span><a className="v mono" target="_blank" rel="noreferrer" href={gwUrl}>{idea.cid}</a></div>
          <div className="d-kv"><span className="k">Proponente</span><span className="v mono">{short(idea.submitter)}</span></div>
          <div className="d-kv"><span className="k">Depósito Colateral</span><span className="v">{formatEther(idea.deposit)} ETH</span></div>
        </div>

        {idea.status === 0 && (
          <div className="d-sec">
            <div className="d-lab">Gobernanza del Council (Safe Multi-sig)</div>
            {idea._queued ? (
              <div className="d-hint">Esta idea está <b>en cola</b>. Se podrá votar cuando se resuelva la primera.</div>
            ) : !wallet.address || !wallet.isOwner ? (
              <div className="d-hint">Conecta una wallet <b>signer</b> del Safe para aprobar o rechazar.</div>
            ) : (
              <>
                <div className="d-actions">
                  <button className="act approve" disabled={guard.signedApprove || guard.signedReject || !hasVoting} onClick={() => handleSign(true)}>
                    {guard.signedApprove ? "Aprobado ✓" : "Aprobar"}
                  </button>
                  <button className="act reject" disabled={guard.signedReject || guard.signedApprove} onClick={() => handleSign(false)}>
                    {guard.signedReject ? "Rechazado ✓" : "Rechazar"}
                  </button>
                </div>

                <div className="d-hint">
                  {guard.signedApprove && <>Ya firmaste <b>aprobar</b> esta idea. Una firma no se puede retirar.</>}
                  {guard.signedReject && <>Ya firmaste <b>rechazar</b> esta idea. Una firma no se puede retirar.</>}
                  {!hasVoting && !guard.signedApprove && "Aprobar deshabilitado: la idea no trae parámetros de votación."}
                </div>

                <div className="d-progress">
                  {progress.loading ? (
                    <div className="pg-row">Leyendo firmas on-chain…</div>
                  ) : (
                    <>
                      <div className="pg-row"><b>Aprobar</b><span>{progress.approve.count}/{progress.threshold} firmas</span></div>
                      <div className="pg-hash">{short(progress.approve.hash || "")}</div>
                      {progress.approve.count >= progress.threshold && (
                        <button className="act exec approve" onClick={() => handleExecute(true)}>Ejecutar · aprobación</button>
                      )}

                      <div className="pg-row" style={{ marginTop: '12px' }}><b>Rechazar</b><span>{progress.reject.count}/{progress.threshold} firmas</span></div>
                      <div className="pg-hash">{short(progress.reject.hash || "")}</div>
                      {progress.reject.count >= progress.threshold && (
                        <button className="act exec reject" onClick={() => handleExecute(false)}>Ejecutar · rechazo</button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            {progressMsg && <div className="d-hint" style={{ color: "var(--amber)" }}>{progressMsg}</div>}
          </div>
        )}
      </div>
    </div>
  );
};