import { NextRequest, NextResponse } from 'next/server';

// --- Rate Limiting ---
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 3000;

// --- Specific subpaths that return fast from CDX (not whole-domain wildcards) ---
const SEARCH_PATHS = [
  // GeoCities neighborhoods — specific enough to be fast
  'geocities.com/SunsetStrip/Towers/*',
  'geocities.com/SunsetStrip/Backstage/*',
  'geocities.com/SunsetStrip/Alley/*',
  'geocities.com/Heartland/Plains/*',
  'geocities.com/Heartland/Prairie/*',
  'geocities.com/Heartland/Hills/*',
  'geocities.com/SiliconValley/Lab/*',
  'geocities.com/SiliconValley/Park/*',
  'geocities.com/SiliconValley/Lakes/*',
  'geocities.com/Area51/Nebula/*',
  'geocities.com/Area51/Cavern/*',
  'geocities.com/Area51/Lair/*',
  'geocities.com/EnchantedForest/Glade/*',
  'geocities.com/EnchantedForest/Tower/*',
  'geocities.com/Hollywood/Hills/*',
  'geocities.com/Hollywood/Lot/*',
  'geocities.com/BourbonStreet/Quarter/*',
  'geocities.com/Athens/Acropolis/*',
  'geocities.com/Athens/Parthenon/*',
  'geocities.com/Athens/Forum/*',
  'geocities.com/Colosseum/Field/*',
  'geocities.com/Tokyo/Towers/*',
  'geocities.com/RainForest/Canopy/*',
  'geocities.com/CapitolHill/Lobby/*',
  'geocities.com/WestHollywood/Village/*',
  'geocities.com/TheTropics/Shores/*',
  'geocities.com/Yosemite/Rapids/*',
  'geocities.com/NapaValley/Vineyard/*',
  'geocities.com/Pentagon/Quarters/*',
  'geocities.com/TimesSquare/Arcade/*',
  // Angelfire — specific categories
  'angelfire.com/ca/*',
  'angelfire.com/tx/*',
  'angelfire.com/ny/*',
  'angelfire.com/fl/*',
  'angelfire.com/oh/*',
  'angelfire.com/pa/*',
  'angelfire.com/scifi/*',
  'angelfire.com/games/*',
  'angelfire.com/art/*',
  'angelfire.com/music/*',
  'angelfire.com/journal/*',
  'angelfire.com/grrl/*',
  'angelfire.com/punk/*',
  'angelfire.com/goth/*',
  // Tripod members
  'members.tripod.com/~*',
  // Fortunecity
  'fortunecity.com/tattooine/*',
  'fortunecity.com/roswell/*',
  'fortunecity.com/rivendell/*',
  'fortunecity.com/lavender/*',
  // OoCities (geocities mirror)
  'www.oocities.org/heartland/*',
  'www.oocities.org/sunsetstrip/*',
  'www.oocities.org/area51/*',
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
  var text = html;
  // Remove script/style/nav blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  text = text.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  // Remove Wayback Machine toolbar/banner if present
  text = text.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, ' ');
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&[#a-z0-9]+;/gi, ' ');
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function extractMeaningfulText(rawText: string): string | null {
  var sentences = rawText.split(/(?<=[.!?])\s+/).filter(function(s) { return s.length > 15; });
  if (sentences.length === 0) return null;

  var bestBlock = '';
  var currentBlock = '';

  for (var i = 0; i < sentences.length; i++) {
    var sentence = sentences[i];
    var urlCount = (sentence.match(/https?:\/\/|www\./g) || []).length;
    var wordCount = sentence.split(/\s+/).length;
    if (urlCount > wordCount / 3) continue;

    var lowerSentence = sentence.toLowerCase();
    if (
      lowerSentence.includes('click here to enter') ||
      lowerSentence.includes('javascript required') ||
      (lowerSentence.includes('best viewed with') && sentence.length < 60) ||
      (lowerSentence.includes('under construction') && sentence.length < 40) ||
      lowerSentence.includes('loading...') ||
      lowerSentence.includes('skip navigation') ||
      (lowerSentence.includes('all rights reserved') && sentence.length < 50) ||
      lowerSentence.includes('wayback machine') ||
      lowerSentence.includes('internet archive') ||
      lowerSentence.includes('got an http')
    ) continue;

    currentBlock += (currentBlock ? ' ' : '') + sentence;

    if (currentBlock.length > bestBlock.length) {
      bestBlock = currentBlock;
    }

    if (sentence.length < 20) {
      currentBlock = '';
    }
  }

  if (bestBlock.length < 80) return null;
  return bestBlock;
}

function truncateToOracle(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  var truncated = text.substring(0, maxLen);
  var lastPeriod = truncated.lastIndexOf('.');
  var lastExclaim = truncated.lastIndexOf('!');
  var lastQuestion = truncated.lastIndexOf('?');
  var lastBoundary = Math.max(lastPeriod, lastExclaim, lastQuestion);

  if (lastBoundary > maxLen * 0.4) {
    return truncated.substring(0, lastBoundary + 1);
  }
  var lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

function isValidResult(text: string): boolean {
  if (text.length < 80) return false;
  var urlMatches = text.match(/https?:\/\/\S+|www\.\S+/g) || [];
  var urlChars = urlMatches.join('').length;
  if (urlChars > text.length * 0.4) return false;
  var navSeparators = (text.match(/[|[\]►●•→»]/g) || []).length;
  if (navSeparators > 15) return false;
  var words = text.split(/\s+/).filter(function(w) { return w.length > 2; });
  if (words.length < 10) return false;
  return true;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateDecayIndex(year: number): number {
  var age = 2026 - year;
  return Math.min(95, Math.max(5, Math.floor((age / 30) * 100)));
}

function serveFallback(): NextResponse {
  var fallback = getRandomElement(FALLBACK_TRANSMISSIONS);
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

export async function GET(request: NextRequest) {
  // Rate limiting
  var ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  var now = Date.now();
  var lastRequest = cooldowns.get(ip) || 0;

  if (now - lastRequest < COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'Signal interference. Wait before scanning again.', retryAfter: Math.ceil((COOLDOWN_MS - (now - lastRequest)) / 1000) },
      { status: 429 }
    );
  }
  cooldowns.set(ip, now);

  // Cleanup old entries
  if (cooldowns.size > 1000) {
    var cutoff = now - COOLDOWN_MS * 10;
    var entries = Array.from(cooldowns.entries());
    for (var ei = 0; ei < entries.length; ei++) {
      if (entries[ei][1] < cutoff) cooldowns.delete(entries[ei][0]);
    }
  }

  // Hard deadline — Vercel free tier kills at 10s
  var DEADLINE = Date.now() + 8000;
  var MAX_RETRIES = 3;

  for (var attempt = 0; attempt < MAX_RETRIES; attempt++) {
    var remaining = DEADLINE - Date.now();
    if (remaining < 2000) break;

    try {
      var searchPath = getRandomElement(SEARCH_PATHS);
      var year = 1996 + Math.floor(Math.random() * 9); // 1996-2004

      // CDX query with specific subpath — much faster than whole-domain wildcard
      var cdxUrl = 'https://web.archive.org/cdx/search/cdx?url=' + searchPath +
        '&output=json&limit=20&from=' + year + '0101&to=' + year + '1231' +
        '&filter=mimetype:text/html&filter=statuscode:200&fl=original,timestamp';

      var cdxTimeout = Math.min(3000, remaining - 1000);
      if (cdxTimeout < 800) break;

      var controller1 = new AbortController();
      var timer1 = setTimeout(function() { controller1.abort(); }, cdxTimeout);

      var cdxResponse: Response;
      try {
        cdxResponse = await fetch(cdxUrl, {
          signal: controller1.signal,
          headers: { 'User-Agent': 'DeadInternetOracle/1.0 (digital-archaeology research project)' },
        });
      } finally {
        clearTimeout(timer1);
      }

      if (!cdxResponse.ok) continue;

      var cdxText = await cdxResponse.text();
      var cdxData: string[][];
      try {
        cdxData = JSON.parse(cdxText);
      } catch (_pe) {
        continue;
      }

      // First row is headers, need at least 2 rows
      if (!Array.isArray(cdxData) || cdxData.length < 2) continue;

      // Pick a random result (skip header row)
      var results = cdxData.slice(1);
      var pick = getRandomElement(results);
      if (!pick || pick.length < 2) continue;
      var originalUrl = pick[0];
      var timestamp = pick[1];

      // Fetch the archived page — use id_/ for raw content (no Wayback toolbar)
      var pageRemaining = DEADLINE - Date.now();
      var pageTimeout = Math.min(3500, pageRemaining - 500);
      if (pageTimeout < 800) break;

      var archiveUrl = 'https://web.archive.org/web/' + timestamp + 'id_/' + originalUrl;
      var controller2 = new AbortController();
      var timer2 = setTimeout(function() { controller2.abort(); }, pageTimeout);

      var pageResponse: Response;
      try {
        pageResponse = await fetch(archiveUrl, {
          signal: controller2.signal,
          headers: { 'User-Agent': 'DeadInternetOracle/1.0 (digital-archaeology research project)' },
        });
      } finally {
        clearTimeout(timer2);
      }

      if (!pageResponse.ok) continue;

      var html = await pageResponse.text();

      // Skip very large pages (probably not personal homepages)
      if (html.length > 200000) continue;

      var strippedText = stripHtml(html);
      var meaningfulText = extractMeaningfulText(strippedText);

      if (!meaningfulText || !isValidResult(meaningfulText)) continue;

      var oracleText = truncateToOracle(meaningfulText, 500);
      var pageYear = parseInt(timestamp.substring(0, 4));

      // Clean source URL for display
      var source = originalUrl;
      try {
        var cleanUrl = originalUrl.startsWith('http') ? originalUrl : 'http://' + originalUrl;
        var parsed = new URL(cleanUrl);
        source = parsed.host + parsed.pathname;
        // Remove trailing slash if it's just the path
        if (source.endsWith('/') && source.length > 1) {
          source = source.slice(0, -1);
        }
      } catch (_ue) {
        // Keep original
      }

      return NextResponse.json({
        text: oracleText,
        source: source,
        timestamp: timestamp,
        year: pageYear,
        signalStrength: 15 + Math.floor(Math.random() * 81),
        decayIndex: calculateDecayIndex(pageYear),
        fallback: false,
      });
    } catch (_err) {
      continue;
    }
  }

  // All retries failed or deadline hit — serve fallback
  return serveFallback();
}
