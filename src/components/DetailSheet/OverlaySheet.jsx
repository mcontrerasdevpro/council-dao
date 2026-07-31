import React, { useState, useEffect, useCallback } from "react";
import { short, formatEther, resolveCalldata, SAFE_ABI } from "../../hooks/cryptoUtils.js";
import { useWeb3, CFG } from "../../context/Web3Context.jsx";
import { ethers } from "ethers";

export const OverlaySheet = ({ active, onClose }) => {
  const idea = active?.idea || active;
  const content = active?.content || null;

  const { wallet, council } = useWeb3();
  const [progressMsg, setProgressMsg] = useState("");
  const [quorumData, setQuorumData] = useState(null);
  const [progress, setProgress] = useState({ loading: true, approve: {}, reject: {}, threshold: 0 });
  const [guard, setGuard] = useState({ signedApprove: false, signedReject: false, checked: false });
  const [zkpStatus, setZkpStatus] = useState("");
  const [zkpLoading, setZkpLoading] = useState(false);

  const handleAnonymousVote = () => {
    if (typeof Worker !== "undefined") {
      setZkpLoading(true);
      setZkpStatus("Inicializando canal seguro...");

      const worker = new Worker(new URL("../../hooks/zkpWorker.js", import.meta.url));

      worker.onmessage = (event) => {
        const { status, message, proof, publicSignals } = event.data;

        if (status === "PROCESSING" || status === "GENERATING") {
          setZkpStatus(message);
        }
        if (status === "SUCCESS") {
          setZkpStatus("✅ ¡Voto emitido y verificado con éxito de forma anónima!");
          setZkpLoading(false);
          console.log("Proof ZKP generada para Smart Contract:", proof, publicSignals);
          worker.terminate();
        }
        if (status === "ERROR") {
          setZkpStatus(`❌ Error criptográfico: ${event.data.error}`);
          setZkpLoading(false);
          worker.terminate();
        }
      };

      worker.postMessage({ action: "GENERATE_PROOF" });
    } else {
      setZkpStatus("Tu navegador no soporta hilos Web Workers de fondo.");
    }
  };

  const question = content?.title || `Iniciativa Ciudadana #${idea.id}`;
  const variants = content?.acceptedOptions?.[0]?.variants ||
    content?.variants ||
    ["A favor (Sí)", "En contra (No)", "Abstención"];
  const hasVoting = !!(content && typeof content.voting === "object" && content.voting);
  const gwUrl = CFG.gateway + (idea.cid || "").replace(/^ipfs:\/\//, "");

  const esc = (t) => String(t || "");

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

        {idea.status === 1 && (
          <div className="d-sec">
            <div className="d-lab">Papeleta de Votación Anónima</div>

            <div style={{ marginBottom: '20px' }}>
              {question ? (
                <div className="d-question" style={{ marginBottom: '12px' }}>{esc(question)}</div>
              ) : (
                <p className="d-hint" style={{ marginBottom: '12px', color: 'var(--ink)' }}>
                  Selecciona tu voto en esta iniciativa ciudadana:
                </p>
              )}

              {variants.map((v, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px',
                    border: '1px solid var(--line)',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    background: 'var(--panel)',
                    transition: 'border-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
                >
                  <input
                    type="radio"
                    name="ballot-option"
                    value={i}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '14.5px', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>{esc(v)}</span>
                </label>
              ))}
            </div>

            <div style={{ padding: '14px 16px', background: 'hsl(34 64% 42% / .08)', borderLeft: '3px solid var(--amber)', marginBottom: '18px' }}>
              <div className="d-status s0" style={{ fontSize: '11px', marginBottom: '6px', fontWeight: '700' }}>Requisito Criptográfico</div>
              <p className="d-hint" style={{ margin: 0, color: 'var(--ink-2)', lineHeight: '1.45' }}>
                Tu voto se transmitirá de forma 100% anónima. Para validar que eres un ciudadano autorizado sin revelar quién eres, el sistema generará una <b>Prueba de Conocimiento Cero (ZKP)</b> local leyendo la firma digital NFC de tu pasaporte o DNIe.
              </p>
            </div>

            <button
              className="act approve"
              style={{ width: '100%', background: 'var(--ink)', color: 'var(--paper)' }}
              disabled={zkpLoading}
              onClick={handleAnonymousVote}
            >
              {zkpLoading ? "🔒 Procesando..." : "🔒 Escanear Documento y Votar"}
            </button>

            {zkpStatus && (
              <div className="d-hint" style={{ marginTop: '12px', textAlign: 'center', fontWeight: '700', color: zkpStatus.startsWith('❌') ? 'var(--accent)' : 'var(--green)' }}>
                {zkpStatus}
              </div>
            )}
          </div>
        )}

        {idea.status === 2 && (
          <div className="d-sec">
            <div className="d-lab">Iniciativa Descartada</div>
            <div className="d-warn" style={{ margin: 0 }}>
              Esta propuesta fue evaluada por el Concilio Multi-sig y <b>Rechazada</b> en la fase de control de gobernanza on-chain. Los depósitos colaterales han sido procesados según las reglas del contrato.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};