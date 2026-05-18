"use client";
import { useState, useEffect } from "react";

export default function SplashScreen() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 2000);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .flx-splash {
          position: fixed; inset: 0; background: #000;
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; pointer-events: none;
          animation: flxFade 0.6s ease 1.4s forwards;
        }
        .flx-word {
          font-family: 'Bebas Neue', 'Arial Narrow', sans-serif;
          font-size: 22vw; color: #CCFF00;
          letter-spacing: -0.02em; line-height: 1;
          animation: flxWordIn 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes flxWordIn {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes flxFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div className="flx-splash">
        <span className="flx-word">FLX.</span>
      </div>
    </>
  );
}