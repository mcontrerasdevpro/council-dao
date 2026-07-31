import React, { useState } from 'react';

export default function ProposalForm({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(90);
  const [variants, setVariants] = useState(['', '']);

  const handleAddVariant = () => setVariants([...variants, '']);
  const handleVariantChange = (index, value) => {
    const next = [...variants];
    next[index] = value;
    setVariants(next);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const cleanVariants = variants.filter(v => v.trim() !== '');
    onSubmit({ 
      title, 
      description, 
      durationDays: Number(duration), 
      acceptedOptions: [{ title, variants: cleanVariants }] 
    });
  };

  return (
    <div className="card reveal" style={{ padding: '24px', cursor: 'default', background: 'var(--panel)', border: '1px solid var(--line)', marginTop: '16px', textAlign: 'left' }}>
      <div className="col-head" style={{ marginBottom: '16px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <span className="name" style={{ fontSize: '14px', letterSpacing: '.1em' }}>Presentar Nueva Propuesta Ciudadana</span>
      </div>
      
      <form onSubmit={handleFormSubmit}>
        <div style={{ marginBottom: '14px' }}>
          <label className="d-lab" style={{ display: 'block', marginBottom: '6px' }}>Título de la propuesta</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            style={{ width: '100%', padding: '10px', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label className="d-lab" style={{ display: 'block', marginBottom: '6px' }}>Descripción / Justificación</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            rows="4" 
            required 
            style={{ width: '100%', padding: '10px', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--sans)', resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label className="d-lab" style={{ display: 'block', marginBottom: '6px' }}>Opciones de la Papeleta</label>
          {variants.map((variant, i) => (
            <input 
              key={i}
              type="text" 
              placeholder={`Opción ${i + 1}`}
              value={variant} 
              onChange={(e) => handleVariantChange(i, e.target.value)} 
              required={i < 2}
              style={{ width: '100%', padding: '10px', marginBottom: '8px', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}
            />
          ))}
          <button type="button" onClick={handleAddVariant} className="btn" style={{ background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line)', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold' }}>
            + Añadir Opción
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label className="d-lab" style={{ display: 'block', marginBottom: '6px' }}>Duración de la votación (Días)</label>
          <input 
            type="number" 
            value={duration} 
            onChange={(e) => setDuration(e.target.value)} 
            min="1" 
            required 
            style={{ width: '80px', padding: '10px', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}
          />
        </div>

        <div className="d-actions" style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button type="submit" className="act approve" style={{ flex: '2' }}>Publicar Idea y Depositar Colateral</button>
          <button type="button" onClick={onCancel} className="act reject" style={{ flex: '1' }}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}