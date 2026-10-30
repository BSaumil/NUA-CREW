'use client';

import { useState } from 'react';
import { Banknote, Check } from 'lucide-react';

export function PricePreview() {
  const [promote, setPromote] = useState(false);
  return (
    <div className="price-preview" aria-labelledby="price-preview-title">
      <div>
        <span className="section-kicker">PLAN YOUR FIRST AD</span>
        <h3 id="price-preview-title">See the cost in one glance.</h3>
        <p>Illustrative pricing only. Payments are not live; GST treatment is pending.</p>
        <label className="price-preview__choice">
          <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
          <span>
            Add a 5-day promotion <strong>+ A$30</strong>
            <small>Planned top-five placement, subject to reserved capacity.</small>
          </span>
        </label>
      </div>
      <div className="price-preview__total" role="status" aria-live="polite">
        <Banknote size={24} aria-hidden="true" />
        <span>Planned total</span>
        <strong>A${promote ? 49 : 19}</strong>
        <p>
          <Check size={16} aria-hidden="true" />
          14-day advertisement{promote ? ' + 5-day promotion' : ''}
        </p>
        <small>No automatic renewal</small>
      </div>
    </div>
  );
}
