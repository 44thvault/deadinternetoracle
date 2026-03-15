import { NextRequest, NextResponse } from 'next/server';

// --- Rate Limiting ---
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 3000;

// --- Dead Web Domains ---
const DEAD_DOMAINS = [
  'geocities.com',
  'angelfire.com',
  'tripod.com',
  'xoom.com',
  'fortunecity.com',
  'homestead.com',
  'theglobe.com',
  'expage.com',
  'bolt.com',
  'www.oocities.org',
];

// --- Fallback Transmissions ---
const FALLBACK_TRANSMISSIONS = [
  { text: "Welcome to my homepage!! I made this page all by myself using Notepad. Please sign my guestbook before you leave, you are visitor number 00347 since March 1998. My cat Whiskers says hi!!", source: "geocities.com/~whiskers_mom/index.html", timestamp: "19980315082244", year: 1998 },
  { text: "This page is under construction!! Come back soon for more info about my Star Trek fan fiction. I just got a new scanner so I will be adding pictures of my convention costumes from DragonCon 97.", source: "angelfire.com/scifi/trekker4life/", timestamp: "19970823143012", year: 1997 },
  { text: "If you are reading this then the world did not end on January 1st 2000 like they said it would. I spent $4000 on canned food and a generator. My wife is not happy about this.", source: "geocities.com/SiliconValley/Lakes/4291/y2k.html", timestamp: "20000103191533", year: 2000 },
  { text: "Today I learned how to make text blink and scroll across the screen. My teacher says the internet is just a fad but I think she is wrong. Anyway here are some cool links I found.", source: "tripod.com/~coolkid96/links.html", timestamp: "19961114093045", year: 1996 },
  { text: "R.I.P. to my hamster Snowball who passed away on Tuesday. You were the best hamster anyone could ever ask for. I will always remember how you used to run on your wheel at 3am.", source: "expage.com/snowball_memorial", timestamp: "19990507221834", year: 1999 },
  { text: "PLEASE DO NOT STEAL MY GRAPHICS!! I spent a lot of time making these animated GIFs and I can see in my site stats that people are hotlinking them. If you want to use them just email me and ask nicely.", source: "geocities.com/EnchantedForest/Glade/7721/", timestamp: "19980901145622", year: 1998 },
  { text: "Well the modem finally died. I had to use my allowance to buy a new 56k and now I can't get that new Zelda game. But at least I can update my page again. Dad says I spend too much time online.", source: "fortunecity.com/tattooine/kirk/112/diary.html", timestamp: "19981228103311", year: 1998 },
  { text: "I don't know who is going to read this but I just want to say that middle school is really hard. Everyone pretends to be someone they're not. At least on the internet I can just be myself.", source: "bolt.com/diary/realgirl99", timestamp: "19990914184527", year: 1999 },
  { text: "This webring is dedicated to all fans of The X-Files. The truth is out there and so are we. Click the arrows below to visit other sites in the ring. We currently have 234 members!!", source: "geocities.com/Area51/Nebula/3318/xring.html", timestamp: "19970612110044", year: 1997 },
  { text: "My New Years resolution for 1999 is to update this page more often. I know I said that last year too. But this time I mean it. Also I want to learn JavaScript so I can make a game.", source: "homestead.com/bradspages/newyear.html", timestamp: "19990101030812", year: 1999 },
  { text: "WARNING: This site is best viewed in Netscape Navigator 4.0 at 800x600 resolution with 16-bit color. If you are using Internet Explorer some things might not look right. Sorry!!", source: "tripod.com/~webmaster_dan/", timestamp: "19980420163255", year: 1998 },
  { text: "I finally figured out how to put music on my page!! If you hear Smash Mouth playing that means it's working. If not try refreshing. My friend showed me how to use the EMBED tag.", source: "angelfire.com/grrl/amandas_world/music.html", timestamp: "19990803091744", year: 1999 },
  { text: "Thanks to everyone who entered my poetry contest!! The winner is Sarah from Ohio. Her poem about rain made me cry. Second place goes to anonymouspoet from somewhere in Canada.", source: "geocities.com/~poetrygarden/contest_results.html", timestamp: "20010226155033", year: 2001 },
  { text: "I know nobody comes to this page anymore but I just want to say that I graduated from high school today. When I started this site I was 13 and now I'm 18. Time is weird.", source: "geocities.com/SunsetStrip/Backstage/4118/update.html", timestamp: "20020601204419", year: 2002 },
  { text: "ATTENTION: The Sailor Moon Ring has moved to a new server. Please update your links. If you were a member before you need to re-register. Sorry for the inconvenience.", source: "theglobe.com/sailormoonring/moved.html", timestamp: "19980116074921", year: 1998 },
  { text: "Today is my birthday and nobody IRL remembered but 6 people in my chat room wished me happy birthday so that was really nice. ButterflyGirl if you're reading this thanks for the e-card.", source: "xoom.com/butterflydiary/march14.html", timestamp: "20000314223156", year: 2000 },
  { text: "Well it finally happened. My mom found my website. She read the part about sneaking out to see the Backstreet Boys concert and now I'm grounded. Note to self: don't put your real name on the internet.", source: "bolt.com/confessions/grounded_again", timestamp: "19990429181233", year: 1999 },
  { text: "This page has been up since 1996 and I just realized I never changed the date at the bottom. It still says copyright 1996. I guess that's the year the page was born so maybe it's ok.", source: "fortunecity.com/roswell/sagan/221/about.html", timestamp: "20010830142811", year: 2001 },
  { text: "Goodbye everyone. I'm shutting down this website because I'm going to college and I won't have time to update it anymore. Thank you to all 12 of my regular visitors. It's been fun.", source: "geocities.com/Heartland/Prairie/8844/goodbye.html", timestamp: "20030815191022", year: 2003 },
  { text: "I wonder if anyone will ever read this. I'm just putting my thoughts out into the void. The internet feels so big and I feel so small. But at least here I exist in some way.", source: "angelfire.com/journal/quietvoice/entry1.html", timestamp: "20010412032847", year: 2001 },
];

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&[a-z]+;/gi, ' ');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractMeaningfulText(rawText: string): string | null {
  // Split into sentences/fragments
  const sentences = rawText.split(/(?<=[.!?])\s+/).filter(s => s.length > 15);

  if (sentences.length === 0) return null;

  // Find the longest continuous block of real text
  // by looking for clusters of sentences
  let bestBlock = '';
  let currentBlock = '';

  for (const sentence of sentences) {
    // Skip sentences that are mostly URLs or navigation
    const urlCount = (sentence.match(/https?:\/\/|www\./g) || []).length;
    const wordCount = sentence.split(/\s+/).length;
    if (urlCount > wordCount / 3) continue;

    // Skip common boilerplate
    const lowerSentence = sentence.toLowerCase();
    if (
      lowerSentence.includes('click here to enter') ||
      lowerSentence.includes('javascript required') ||
      lowerSentence.includes('best viewed with') ||
      lowerSentence.includes('under construction') && sentence.length < 40 ||
      lowerSentence.includes('loading...') ||
      lowerSentence.includes('skip navigation') ||
      lowerSentence.includes('all rights reserved') && sentence.length < 50
    ) continue;

    currentBlock += (currentBlock ? ' ' : '') + sentence;

    if (currentBlock.length > bestBlock.length) {
      bestBlock = currentBlock;
    }

    // Reset if gap detected (sentence too short = likely navigation)
    if (sentence.length < 20) {
      currentBlock = '';
    }
  }

  if (bestBlock.length < 80) return null;

  return bestBlock;
}

function truncateToOracle(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text;

  // Try to cut at a sentence boundary
  const truncated = text.substring(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastBoundary = Math.max(lastPeriod, lastExclaim, lastQuestion);

  if (lastBoundary > maxLen * 0.4) {
    return truncated.substring(0, lastBoundary + 1);
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

function isValidResult(text: string): boolean {
  if (text.length < 80) return false;

  // Check if it's mostly URLs
  const urlMatches = text.match(/https?:\/\/\S+|www\.\S+/g) || [];
  const urlChars = urlMatches.join('').length;
  if (urlChars > text.length * 0.4) return false;

  // Check for too many pipe/bracket separators (nav menus)
  const navSeparators = (text.match(/[|[\]►●•→»]/g) || []).length;
  if (navSeparators > 15) return false;

  // Ensure there are actual words
  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 10) return false;

  return true;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateDecayIndex(year: number): number {
  const age = 2026 - year;
  // Older pages = more decay, scale 0-100
  return Math.min(95, Math.max(5, Math.floor((age / 30) * 100)));
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const lastRequest = cooldowns.get(ip) || 0;

  if (now - lastRequest < COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'Signal interference. Wait before scanning again.', retryAfter: Math.ceil((COOLDOWN_MS - (now - lastRequest)) / 1000) },
      { status: 429 }
    );
  }
  cooldowns.set(ip, now);

  // Clean up old cooldowns periodically
  if (cooldowns.size > 1000) {
    const cutoff = now - COOLDOWN_MS * 10;
    for (const [key, val] of Array.from(cooldowns.entries())) {
      if (val < cutoff) cooldowns.delete(key);
    }
  }

  // Hard deadline — Vercel free tier kills at 10s, so we bail at 8s
  const DEADLINE = Date.now() + 8000;
  const MAX_RETRIES = 3;

  function timeLeft() { return Math.max(0, DEADLINE - Date.now()); }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (timeLeft() < 1500) break; // not enough time for another attempt

    try {
      const domain = getRandomElement(DEAD_DOMAINS);
      const year = 1996 + Math.floor(Math.random() * 9); // 1996-2004

      // Query CDX API — tight timeout
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}/*&output=json&limit=25&from=${year}0101&to=${year}1231&filter=mimetype:text/html&fl=original,timestamp`;

      const cdxTimeout = Math.min(3000, timeLeft() - 500);
      if (cdxTimeout < 500) break;

      const cdxResponse = await fetch(cdxUrl, {
        signal: AbortSignal.timeout(cdxTimeout),
        headers: { 'User-Agent': 'DeadInternetOracle/1.0 (research; digital-archaeology)' },
      });

      if (!cdxResponse.ok) continue;

      const cdxData = await cdxResponse.json();

      // First row is headers, need at least 2 rows
      if (!Array.isArray(cdxData) || cdxData.length < 2) continue;

      // Pick a random result (skip header row)
      const results = cdxData.slice(1);
      const pick = getRandomElement(results);
      const [originalUrl, timestamp] = pick;

      // Fetch the archived page — tight timeout
      const pageTimeout = Math.min(3500, timeLeft() - 500);
      if (pageTimeout < 500) break;

      const archiveUrl = `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
      const pageResponse = await fetch(archiveUrl, {
        signal: AbortSignal.timeout(pageTimeout),
        headers: { 'User-Agent': 'DeadInternetOracle/1.0 (research; digital-archaeology)' },
      });

      if (!pageResponse.ok) continue;

      const html = await pageResponse.text();
      const strippedText = stripHtml(html);
      const meaningfulText = extractMeaningfulText(strippedText);

      if (!meaningfulText || !isValidResult(meaningfulText)) continue;

      const oracleText = truncateToOracle(meaningfulText);
      const pageYear = parseInt(timestamp.substring(0, 4));

      // Clean source URL for display
      let source = originalUrl;
      try {
        const parsed = new URL(originalUrl.startsWith('http') ? originalUrl : `http://${originalUrl}`);
        source = parsed.host + parsed.pathname;
      } catch (_e) {
        // Keep original
      }

      return NextResponse.json({
        text: oracleText,
        source,
        timestamp,
        year: pageYear,
        signalStrength: 15 + Math.floor(Math.random() * 81), // 15-95
        decayIndex: calculateDecayIndex(pageYear),
        fallback: false,
      });
    } catch (err) {
      // Network error or timeout, try again
      continue;
    }
  }

  // All retries failed or deadline approaching — serve fallback
  const fallback = getRandomElement(FALLBACK_TRANSMISSIONS);

  return NextResponse.json({
    text: fallback.text,
    source: fallback.source,
    timestamp: fallback.timestamp,
    year: fallback.year,
    signalStrength: 15 + Math.floor(Math.random() * 81),
    decayIndex: calculateDecayIndex(fallback.year),
    fallback: true,
  });
}
