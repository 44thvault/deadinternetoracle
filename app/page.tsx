'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Transmission {
  text: string;
  source: string;
  timestamp: string;
  year: number;
  signalStrength: number;
  decayIndex: number;
  fallback?: boolean;
}

const SCRAMBLE_CHARS = '█▓░▒╗╔═║╚╝╠╣╬┼┤├┬┴─│▀▄■□▪▫●○◊◦';

function formatTimestamp(ts: string): string {
  if (ts.length < 14) return ts;
  const y = ts.substring(0, 4);
  const m = ts.substring(4, 6);
  const d = ts.substring(6, 8);
  const h = ts.substring(8, 10);
  const min = ts.substring(10, 12);
  const s = ts.substring(12, 14);
  return `${y}-${m}-${d} ${h}:${min}:${s} UTC`;
}

function corruptText(text: string, decayIndex: number): (string | { char: string; glitch: boolean })[] {
  const corruptionRate = (decayIndex / 100) * 0.12; // max ~12% corruption at decay 95
  return text.split('').map(char => {
    if (char === ' ' || char === '\n') return char;
    if (Math.random() < corruptionRate) {
      const glitchChar = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      return { char: glitchChar, glitch: true };
    }
    return char;
  });
}

export default function OraclePage() {
  const [transmission, setTransmission] = useState<Transmission | null>(null);
  const [displayedText, setDisplayedText] = useState<(string | { char: string; glitch: boolean })[]>([]);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'scramble' | 'typing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [interceptCount, setInterceptCount] = useState(0);
  const [showCopied, setShowCopied] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [scanDots, setScanDots] = useState('');
  const typingRef = useRef<NodeJS.Timeout | null>(null);
  const scrambleRef = useRef<NodeJS.Timeout | null>(null);
  const dotsRef = useRef<NodeJS.Timeout | null>(null);

  // Animated scanning dots
  useEffect(() => {
    if (phase === 'scanning') {
      let count = 0;
      dotsRef.current = setInterval(() => {
        count = (count + 1) % 4;
        setScanDots('.'.repeat(count));
      }, 400);
      return () => { if (dotsRef.current) clearInterval(dotsRef.current); };
    }
  }, [phase]);

  const generateScramble = useCallback(() => {
    const len = 200 + Math.floor(Math.random() * 100);
    let s = '';
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.08) s += ' ';
      else s += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }
    return s;
  }, []);

  const startScramble = useCallback(() => {
    setPhase('scramble');
    let iterations = 0;
    scrambleRef.current = setInterval(() => {
      setScrambleText(generateScramble());
      iterations++;
      if (iterations > 8) {
        if (scrambleRef.current) clearInterval(scrambleRef.current);
      }
    }, 70);
  }, [generateScramble]);

  const startTyping = useCallback((text: string, decayIndex: number) => {
    const corrupted = corruptText(text, decayIndex);
    setDisplayedText([]);
    setPhase('typing');

    let index = 0;
    typingRef.current = setInterval(() => {
      if (index < corrupted.length) {
        setDisplayedText(prev => [...prev, corrupted[index]]);
        index++;
      } else {
        if (typingRef.current) clearInterval(typingRef.current);
        setPhase('done');
      }
    }, 15);
  }, []);

  const intercept = useCallback(async () => {
    // Cleanup
    if (typingRef.current) clearInterval(typingRef.current);
    if (scrambleRef.current) clearInterval(scrambleRef.current);

    setPhase('scanning');
    setTransmission(null);
    setDisplayedText([]);
    setErrorMsg('');

    try {
      const res = await fetch('/api/oracle', {
        signal: AbortSignal.timeout(12000),
      });

      if (res.status === 429) {
        const data = await res.json();
        setErrorMsg(data.error || 'Signal interference. Wait before scanning again.');
        setPhase('error');
        return;
      }

      if (!res.ok) {
        throw new Error('Dead signal');
      }

      const data: Transmission = await res.json();
      setTransmission(data);
      setInterceptCount(prev => prev + 1);

      // Start scramble effect, then typing
      startScramble();

      setTimeout(() => {
        if (scrambleRef.current) clearInterval(scrambleRef.current);
        startTyping(data.text, data.decayIndex);
      }, 600);
    } catch {
      setErrorMsg('TRANSMISSION LOST — ALL FREQUENCIES DEAD');
      setPhase('error');
    }
  }, [startScramble, startTyping]);

  const captureSignal = useCallback(() => {
    if (!transmission) return;

    const shareText = [
      `☠ DEAD INTERNET ORACLE ☠`,
      ``,
      `"${transmission.text}"`,
      ``,
      `SIGNAL: ${transmission.source}`,
      `CACHED: ${formatTimestamp(transmission.timestamp)}`,
      `DECAY: ${transmission.decayIndex}%`,
      ``,
      `↯ playdecadence.online/oracle`,
    ].join('\n');

    navigator.clipboard.writeText(shareText).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  }, [transmission]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <h1 className="title">DEAD INTERNET ORACLE</h1>
        <p className="subtitle">Receiving transmissions from the abandoned web</p>
      </header>

      {/* Transmission Screen */}
      <div className="screen-container">
        <div className="transmission-screen">
          {/* Screen flash on new transmission */}
          {phase === 'scramble' && <div className="screen-flash" />}

          <div className="screen-inner">
            {/* Meta info - only show when we have data */}
            {transmission && (phase === 'typing' || phase === 'done') && (
              <>
                <div className="meta-line">
                  <span className="label">SIGNAL RECOVERED: </span>
                  <span>{transmission.source}</span>
                </div>
                <div className="meta-line">
                  <span className="label">CACHED: </span>
                  <span>{formatTimestamp(transmission.timestamp)}</span>
                </div>
              </>
            )}

            {/* Oracle text area */}
            <div className="oracle-text-area">
              {phase === 'idle' && (
                <div className="idle-text">
                  DEAD FREQUENCIES DETECTED<br />
                  AWAITING INTERCEPT COMMAND<br /><br />
                  ▼ PRESS BELOW TO SCAN ▼
                </div>
              )}

              {phase === 'scanning' && (
                <div className="scanning-text">
                  SCANNING DEAD FREQUENCIES{scanDots}
                </div>
              )}

              {phase === 'scramble' && (
                <div className="scramble-text">{scrambleText}</div>
              )}

              {(phase === 'typing' || phase === 'done') && (
                <div className={`oracle-text${phase === 'typing' ? ' typing' : ''}`}>
                  {displayedText.map((item, i) =>
                    typeof item === 'string' ? (
                      <span key={i}>{item}</span>
                    ) : (
                      <span key={i} className="glitch-char">{item.char}</span>
                    )
                  )}
                </div>
              )}

              {phase === 'error' && (
                <div className="error-text">{errorMsg}</div>
              )}
            </div>

            {/* Signal bar - only when done */}
            {transmission && phase === 'done' && (
              <>
                <div className="signal-bar-container">
                  <span className="signal-label">SIGNAL</span>
                  <div className="signal-bar-track">
                    <div
                      className="signal-bar-fill"
                      style={{ width: `${transmission.signalStrength}%` }}
                    />
                  </div>
                  <span className="signal-value">{transmission.signalStrength}%</span>
                </div>
                <div className="decay-line">
                  DECAY INDEX: <span>{transmission.decayIndex}%</span> — SIGNAL AGE: {2026 - transmission.year} YEARS
                </div>
                {transmission.fallback && (
                  <div className="fallback-badge">◈ CACHED FRAGMENT — LIVE SIGNAL UNAVAILABLE</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          <button
            className="btn"
            onClick={intercept}
            disabled={phase === 'scanning' || phase === 'scramble' || phase === 'typing'}
          >
            {phase === 'idle' ? 'INTERCEPT TRANSMISSION' : 'INTERCEPT NEW TRANSMISSION'}
          </button>

          {phase === 'done' && transmission && (
            <button className="btn btn-secondary" onClick={captureSignal}>
              CAPTURE SIGNAL
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="status-left">
          <div className="blink-dot" />
          <span>SCANNING DEAD FREQUENCIES...</span>
        </div>
        <div>TRANSMISSIONS INTERCEPTED: {String(interceptCount).padStart(4, '0')}</div>
      </div>

      {/* Copied toast */}
      {showCopied && (
        <div className="copied-toast">
          SIGNAL CAPTURED TO CLIPBOARD
        </div>
      )}
    </div>
  );
}
