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
  if (!ts || ts.length < 14) return ts || '';
  const y = ts.substring(0, 4);
  const m = ts.substring(4, 6);
  const d = ts.substring(6, 8);
  const h = ts.substring(8, 10);
  const min = ts.substring(10, 12);
  const s = ts.substring(12, 14);
  return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s + ' UTC';
}

function corruptText(text: string, decayIndex: number): Array<string | { char: string; glitch: boolean }> {
  if (!text) return [];
  const corruptionRate = (decayIndex / 100) * 0.03;
  return text.split('').map(function(char): string | { char: string; glitch: boolean } {
    if (char === ' ' || char === '\n') return char;
    if (Math.random() < corruptionRate) {
      var glitchChar = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      return { char: glitchChar, glitch: true };
    }
    return char;
  });
}

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return new Promise(function(resolve, reject) {
    var controller = new AbortController();
    var timer = setTimeout(function() {
      controller.abort();
      reject(new Error('Request timed out'));
    }, timeoutMs);

    fetch(url, { signal: controller.signal })
      .then(function(res) {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(function(err) {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export default function OraclePage() {
  const [transmission, setTransmission] = useState<Transmission | null>(null);
  const [displayedText, setDisplayedText] = useState<Array<string | { char: string; glitch: boolean }>>([]);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'scramble' | 'typing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [interceptCount, setInterceptCount] = useState(0);
  const [showCopied, setShowCopied] = useState(false);
  const [scrambleText, setScrambleText] = useState('');
  const [scanDots, setScanDots] = useState('');
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(function() {
    if (phase === 'scanning') {
      var count = 0;
      dotsRef.current = setInterval(function() {
        count = (count + 1) % 4;
        setScanDots('.'.repeat(count));
      }, 400);
      return function() {
        if (dotsRef.current) clearInterval(dotsRef.current);
      };
    }
  }, [phase]);

  var generateScramble = useCallback(function() {
    var len = 200 + Math.floor(Math.random() * 100);
    var s = '';
    for (var i = 0; i < len; i++) {
      if (Math.random() < 0.08) s += ' ';
      else s += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }
    return s;
  }, []);

  var startScramble = useCallback(function() {
    setPhase('scramble');
    var iterations = 0;
    scrambleRef.current = setInterval(function() {
      setScrambleText(generateScramble());
      iterations++;
      if (iterations > 8) {
        if (scrambleRef.current) clearInterval(scrambleRef.current);
      }
    }, 70);
  }, [generateScramble]);

  var startTyping = useCallback(function(text: string, decayIndex: number) {
    var corrupted = corruptText(text, decayIndex);
    setDisplayedText([]);
    setPhase('typing');

    var index = 0;
    typingRef.current = setInterval(function() {
      if (index < corrupted.length) {
        var currentIndex = index;
        setDisplayedText(function(prev) { return prev.concat([corrupted[currentIndex]]); });
        index++;
      } else {
        if (typingRef.current) clearInterval(typingRef.current);
        setPhase('done');
      }
    }, 15);
  }, []);

  var intercept = useCallback(async function() {
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    if (scrambleRef.current) { clearInterval(scrambleRef.current); scrambleRef.current = null; }

    setPhase('scanning');
    setTransmission(null);
    setDisplayedText([]);
    setErrorMsg('');

    try {
      var res = await fetchWithTimeout('/api/oracle', 15000);

      if (res.status === 429) {
        var msg = 'Signal interference. Wait before scanning again.';
        try {
          var errData = await res.json();
          if (errData && errData.error) msg = errData.error;
        } catch (parseErr) { /* ignore */ }
        setErrorMsg(msg);
        setPhase('error');
        return;
      }

      if (!res.ok) {
        setErrorMsg('TRANSMISSION LOST \u2014 SIGNAL RETURNED ' + res.status);
        setPhase('error');
        return;
      }

      var rawText = await res.text();
      var data: Transmission;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        setErrorMsg('CORRUPTED SIGNAL \u2014 COULD NOT DECODE TRANSMISSION');
        setPhase('error');
        return;
      }

      if (!data || !data.text) {
        setErrorMsg('EMPTY SIGNAL \u2014 NO TRANSMISSION DATA');
        setPhase('error');
        return;
      }

      setTransmission(data);
      setInterceptCount(function(prev) { return prev + 1; });

      startScramble();

      setTimeout(function() {
        if (scrambleRef.current) clearInterval(scrambleRef.current);
        startTyping(data.text, data.decayIndex || 50);
      }, 600);

    } catch (fetchErr) {
      setErrorMsg('TRANSMISSION LOST \u2014 ALL FREQUENCIES DEAD');
      setPhase('error');
    }
  }, [startScramble, startTyping]);

  var captureSignal = useCallback(function() {
    if (!transmission) return;

    var shareText = [
      '\u2620 DEAD INTERNET ORACLE \u2620',
      '',
      '"' + transmission.text + '"',
      '',
      'SIGNAL: ' + transmission.source,
      'CACHED: ' + formatTimestamp(transmission.timestamp),
      'DECAY: ' + transmission.decayIndex + '%',
      '',
      '\u21AF deadinternetoracle.vercel.app',
    ].join('\n');

    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareText).then(function() {
          setShowCopied(true);
          setTimeout(function() { setShowCopied(false); }, 2000);
        }).catch(function() { /* silently fail */ });
      }
    } catch (clipErr) {
      /* clipboard not available */
    }
  }, [transmission]);

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">DEAD INTERNET ORACLE</h1>
        <p className="subtitle">Receiving transmissions from the abandoned web</p>
      </header>

      <div className="screen-container">
        <div className="transmission-screen">
          {phase === 'scramble' && <div className="screen-flash" />}

          <div className="screen-inner">
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

            <div className="oracle-text-area">
              {phase === 'idle' && (
                <div className="idle-text">
                  DEAD FREQUENCIES DETECTED<br />
                  AWAITING INTERCEPT COMMAND<br /><br />
                  &#9660; PRESS BELOW TO SCAN &#9660;
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
                <div className={'oracle-text' + (phase === 'typing' ? ' typing' : '')}>
                  {displayedText.map(function(item, i) {
                    if (typeof item === 'string') {
                      return <span key={i}>{item}</span>;
                    }
                    return <span key={i} className="glitch-char">{item.char}</span>;
                  })}
                </div>
              )}

              {phase === 'error' && (
                <div className="error-text">{errorMsg}</div>
              )}
            </div>

            {transmission && phase === 'done' && (
              <>
                <div className="signal-bar-container">
                  <span className="signal-label">SIGNAL</span>
                  <div className="signal-bar-track">
                    <div
                      className="signal-bar-fill"
                      style={{ width: transmission.signalStrength + '%' }}
                    />
                  </div>
                  <span className="signal-value">{transmission.signalStrength}%</span>
                </div>
                <div className="decay-line">
                  DECAY INDEX: <span>{transmission.decayIndex}%</span> &#8212; SIGNAL AGE: {2026 - transmission.year} YEARS
                </div>
                {transmission.fallback && (
                  <div className="fallback-badge">&#9670; CACHED FRAGMENT &#8212; LIVE SIGNAL UNAVAILABLE</div>
                )}
              </>
            )}
          </div>
        </div>

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

      <div className="status-bar">
        <div className="status-left">
          <div className="blink-dot" />
          <span>SCANNING DEAD FREQUENCIES...</span>
        </div>
        <div>TRANSMISSIONS INTERCEPTED: {String(interceptCount).padStart(4, '0')}</div>
      </div>

      {showCopied && (
        <div className="copied-toast">
          SIGNAL CAPTURED TO CLIPBOARD
        </div>
      )}
    </div>
  );
}
