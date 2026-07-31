import React from 'react';
import IdeaCard from './IdeaCard';

export default function Column({ title, idx, badgeClass, ideas, isPendingColumn, onSelect }) {
  const subs = {
    pending: "Las ideas enviadas aparecen aquí para revisión.",
    approved: "Aún ninguna promovida a votación.",
    rejected: "Ninguna descartada por el Council."
  };

  return (
    <div className="col reveal">
      <div className="col-head">
        <span className="idx">{idx}</span>
        <span className={`sq ${badgeClass}`}></span>
        <span className="name">{title}</span>
        <span className="n">{ideas.length}</span>
      </div>
      <div>
        {ideas.length === 0 ? (
          <div className="empty">
            <div className="bar"></div>
            <div className="big">Sin registros</div>
            <div className="sub">{subs[badgeClass]}</div>
          </div>
        ) : (
          ideas.map((idea, index) => (
            <IdeaCard 
              key={idea.id} 
              idea={idea} 
              queued={isPendingColumn && index > 0} 
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}