import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from './context/Web3Context';
import Masthead from './components/Layout/Masthead';
import Ledger from './components/Layout/Ledger';
import Column from './components/Board/Column';
import { OverlaySheet } from './components/DetailSheet/OverlaySheet';
import { decodeIdeas, formatEther } from './hooks/cryptoUtils';

const STATUS_KEYS = ["pending", "approved", "rejected"];

export default function App() {
  const { CFG, SEL, ethCall, fetchCouncil, errorMsg, setErrorMsg, triggerRefresh } = useWeb3();
  const [ledger, setLedger] = useState({ total: 0, fee: "···", base: "···", safe: "···", proposals: "···", loading: true });
  const [ideas, setIdeas] = useState([]);
  const [selectedIdea, setSelectedIdea] = useState(null);

  const pad32 = (n) => BigInt(n).toString(16).padStart(64, "0");

  const initData = useCallback(async () => {
    try {
      const [nextId, fee, base, safe, , proposals] = await Promise.all([
        ethCall(CFG.registry, SEL.nextId),
        ethCall(CFG.registry, SEL.fee),
        ethCall(CFG.registry, SEL.base),
        ethCall(CFG.registry, SEL.safe),
        ethCall(CFG.registry, SEL.treasury),
        ethCall(CFG.registry, SEL.proposals)
      ]);

      const total = Number(BigInt(nextId));
      const safeAddr = "0x" + safe.replace(/^0x/, "").slice(24);
      const propAddr = "0x" + proposals.replace(/^0x/, "").slice(24);

      setLedger({
        total,
        fee: formatEther(fee),
        base: formatEther(base),
        safe: safeAddr,
        proposals: propAddr,
        loading: false
      });

      fetchCouncil(safeAddr);

      if (total > 0) {
        const pageHex = await ethCall(CFG.registry, SEL.getPage + pad32(0) + pad32(Math.min(total, 200)));
        setIdeas(decodeIdeas(pageHex));
      }
    } catch (e) {
      setErrorMsg("No se pudo leer la cadena: " + e.message);
      setLedger(prev => ({ ...prev, loading: false }));
    }
  }, [ethCall, fetchCouncil, CFG.registry, SEL, triggerRefresh]);

  useEffect(() => { initData(); }, [initData]);

  const buckets = { pending: [], approved: [], rejected: [] };
  ideas.forEach(idea => {
    const s = STATUS_KEYS[idea.status] || "pending";
    buckets[s].push(idea);
  });

  return (
    <>
      <div className="wrap">
        <Masthead />
        {errorMsg && <div className="banner show">{errorMsg}</div>}
        <Ledger ledger={ledger} />

        <div className="board-head">
          <h2>Ideas</h2>
          <span className="qcount">
            {ledger.loading ? "cargando" : ledger.total === 0 ? "· cola vacía" : `· ${ledger.total} en total`}
          </span>
        </div>

        <div className="board">
          <Column title="Pendientes" idx="01" badgeClass="pending" ideas={buckets.pending} isPendingColumn={true} onSelect={setSelectedIdea} />
          <Column title="Aprobadas" idx="02" badgeClass="approved" ideas={buckets.approved} onSelect={setSelectedIdea} />
          <Column title="Rechazadas" idx="03" badgeClass="rejected" ideas={buckets.rejected} onSelect={setSelectedIdea} />
        </div>
      </div>

      {selectedIdea && (
        <DetailOverlay idea={selectedIdea} onClose={() => setSelectedIdea(null)} />
      )}
    </>
  );
}