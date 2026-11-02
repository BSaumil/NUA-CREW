import { ImageResponse } from 'next/og';

export const alt =
  'NUA CREW — Better Jobs. Stronger Teams. Australia and New Zealand in preparation.';
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
        background: '#F7F3EF',
        color: '#3C0B21',
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
            background: '#3C0B21',
            color: '#F7F3EF',
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          NUA
        </span>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: 5 }}>CREW</span>
      </div>
      <div style={{ display: 'flex', fontSize: 77, fontWeight: 800, lineHeight: 1.08 }}>
        Better Jobs.
      </div>
      <div style={{ display: 'flex', fontSize: 77, fontWeight: 800, lineHeight: 1.08 }}>
        Stronger Teams.
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 25,
          marginTop: 38,
          color: '#6B1738',
          fontWeight: 600,
        }}
      >
        Hospitality recruitment · Australia & New Zealand · Pre-launch
      </div>
    </div>,
    size,
  );
}
