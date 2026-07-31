import React from 'react';
import { useWeb3 } from '../../context/Web3Context';

export default function Ledger({ ledger }) {
  const { CFG } = useWeb3();
  const short = (a) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "···";

  return (
    <section className="ledger">
      <div className="ledger-hero reveal" style={{ animationDelay: '.02s' }}>
        <div>
          <span className="lab">Ideas recibidas</span>
          <div className={`hero-num ${ledger.loading ? 'loading' : ''}`}>{ledger.total}</div>
        </div>
      </div>
      <div className="ledger-grid">
        <div className="cell reveal" style={{ animationDelay: '.06s' }}>
          <span className="lab">Depósito</span>
          <span className={`val ${ledger.loading ? 'loading' : ''}`}>{ledger.fee}<span className="u">ETH</span></span>
        </div>
        <div className="cell reveal" style={{ animationDelay: '.10s' }}>
          <span className="lab">Retención</span>
          <span className={`val ${ledger.loading ? 'loading' : ''}`}>{ledger.base}<span className="u">ETH</span></span>
        </div>
        <div className="cell reveal" style={{ animationDelay: '.14s' }}>
          <span className="lab">Council</span>
          <a className={`val mono ${ledger.loading ? 'loading' : ''}`} href={`${CFG.explorer}${ledger.safe}`} target="_blank" rel="noopener noreferrer">
            {short(ledger.safe)}
          </a>
        </div>
        <div className="cell reveal" style={{ animationDelay: '.18s' }}>
          <span className="lab">Votaciones</span>
          <a className={`val mono ${ledger.loading ? 'loading' : ''}`} href={`${CFG.explorer}${ledger.proposals}`} target="_blank" rel="noopener noreferrer">
            {short(ledger.proposals)}
          </a>
        </div>
      </div>
    </section>
  );
}