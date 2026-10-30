'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';

export function JourneyPreview() {
  const [role, setRole] = useState<'candidate' | 'employer'>('candidate');
  const candidate = role === 'candidate';
  return (
    <div className="journey-preview">
      <div className="journey-preview__switch" role="group" aria-label="Explore your experience">
        <button type="button" aria-pressed={candidate} onClick={() => setRole('candidate')}>
          <BriefcaseBusiness size={18} aria-hidden="true" /> I’m looking for work
        </button>
        <button type="button" aria-pressed={!candidate} onClick={() => setRole('employer')}>
          <Users size={18} aria-hidden="true" /> I’m hiring
        </button>
      </div>
      <div className="journey-preview__body" aria-live="polite" aria-atomic="true">
        <div className="journey-preview__copy">
          <span className="section-kicker">
            {candidate ? 'YOUR NEXT CHAPTER' : 'YOUR NEXT TEAMMATE'}
          </span>
          <h3>{candidate ? 'Work that fits around you.' : 'Good people. Clear next steps.'}</h3>
          <p>
            {candidate
              ? 'Choose your work, share your availability and start a conversation on your terms.'
              : 'Post a clear role, find consenting talent and keep your team’s conversations together.'}
          </p>
          <a className="text-link" href={candidate ? '/job-seekers' : '/employers'}>
            {candidate ? 'Explore job seeker tools' : 'Explore hiring tools'}
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="preview-card">
          <div className="preview-card__heading">
            <span className="site-icon">
              <BriefcaseBusiness size={22} aria-hidden="true" />
            </span>
            <span className="preview-label">Illustrative example</span>
          </div>
          <h4>{candidate ? 'Barista' : 'Alex C.'}</h4>
          <p className="preview-location">
            <MapPin size={15} aria-hidden="true" />
            {candidate ? 'Neighbourhood cafe · Fitzroy, VIC' : 'Barista · Fitzroy, VIC'}
          </p>
          <div className="preview-facts">
            <span>
              <CalendarDays size={16} aria-hidden="true" />
              {candidate ? 'Temporary · 10–20 hrs/week' : 'Availability: shared for a time window'}
            </span>
            <strong>{candidate ? 'A$29–33 / hr' : 'Discovery is opt-in'}</strong>
          </div>
          <div className="preview-tags">
            <span>
              <Check size={14} aria-hidden="true" />
              {candidate ? 'Pay disclosed' : 'Calendar stays private'}
            </span>
            <span>{candidate ? 'Super not stated' : 'Results are not ranked'}</span>
          </div>
          <p className="preview-note">
            <ShieldCheck size={17} aria-hidden="true" />
            {candidate ? 'Your minimum pay stays private.' : 'Only invite someone to an open role.'}
          </p>
          <p className="preview-footer">
            <MessageCircle size={17} aria-hidden="true" /> A conversation starts after an accepted
            invitation.
          </p>
        </div>
      </div>
    </div>
  );
}
