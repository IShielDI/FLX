export default function Loading() {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .flx-loading-word {
          font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
          font-size: 22vw; color: #fff;
          letter-spacing: -0.02em; line-height: 1;
          animation: flxPulse 1s ease-in-out infinite alternate;
        }
        @keyframes flxPulse {
          from { opacity: 0.3; transform: scale(0.97); }
          to   { opacity: 1;   transform: scale(1); }
        }
      `}</style>
      <span className="flx-loading-word">FLX</span>
    </div>
  );
}