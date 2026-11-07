import { ImageResponse } from 'next/og';

export const alt =
  'NUA CREW — Where Talent Meets Opportunity Australia and New Zealand in preparation.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Social-sharing artwork only: not a website banner or a live product screenshot.
 * Uses server-side rendering with no remote fonts, stock imagery or decorative lines.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: '#F6F0E5',
        color: '#111113',
        padding: '74px 92px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginBottom: 46,
        }}
      >
        <span
          style={{
            display: 'flex',
            padding: '16px 22px',
            borderRadius: 15,
            background: '#6B1738',
            color: '#F6F0E5',
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          NUA
        </span>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: 5 }}>CREW</span>
      </div>
      <div style={{ display: 'flex', fontSize: 77, fontWeight: 800, lineHeight: 1.08 }}>
        Where Talent Meets
      </div>
      <div style={{ display: 'flex', fontSize: 77, fontWeight: 800, lineHeight: 1.08 }}>
        Opportunity
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 25,
          marginTop: 38,
          color: '#890A31',
          fontWeight: 600,
        }}
      >
        Hospitality recruitment · Australia & New Zealand · Pre-launch
      </div>
    </div>,
    size,
  );
}
