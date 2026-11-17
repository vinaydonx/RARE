/**
 * RareAnimes REST API - High Speed & Vercel / Heroku / Sevalla Ready
 * Developed by Sujal Chavda (@ChavdaSujal)
 * Source: https://www.rareanimes.foo (formerly rareanimes.mov)
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { fetch, ProxyAgent } = require('undici');
require('dotenv').config();

const app = express();
const BASE_URL = 'https://www.rareanimes.foo';

// ----------------------------------------------------
// 🌐 PROXY POOL CONFIGURATION (Optional for Cloudflare/Vercel)
// ----------------------------------------------------
function parseProxyList() {
  const raw = process.env.PROXY_LIST || process.env.PROXY_URL || '';
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      if (p.startsWith('http://') || p.startsWith('https://')) return p;
      const parts = p.split(':');
      if (parts.length === 4) {
        return `http://${encodeURIComponent(parts[2])}:${encodeURIComponent(parts[3])}@${parts[0]}:${parts[1]}`;
      }
      if (parts.length === 2) {
        return `http://${parts[0]}:${parts[1]}`;
      }
      return p;
    });
}

const proxyPool = parseProxyList();
let proxyIndex = 0;

function getProxyAgent() {
  if (proxyPool.length === 0) return undefined;
  const proxy = proxyPool[proxyIndex % proxyPool.length];
  proxyIndex++;
  try {
    return new ProxyAgent(proxy);
  } catch (_) {
    return undefined;
  }
}

// ----------------------------------------------------
// ⚡ HIGH SPEED IN-MEMORY TTL CACHE
// ----------------------------------------------------
const memoryCache = new Map();

function getCached(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlSeconds = 300) {
  if (memoryCache.size > 500) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000
  });
}

// Middlewares
app.use(cors());
app.use(compression());
app.use(express.json());

// Edge Caching Header
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200');
  next();
});

// Dynamic session & client ID generator for Cloudflare bypass
function generateZipperCookies() {
  const clientId = crypto.randomBytes(8).toString('hex');
  const sessId = crypto.randomBytes(13).toString('hex');
  return `zipper_client_id=${clientId}; PHPSESSID=${sessId}`;
}

// Browser-identical headers
function getHeaders(isZipper = false) {
  const headers = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'referer': 'https://www.rareanimes.foo/',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Brave";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': isZipper ? 'cross-site' : 'same-origin',
    'sec-fetch-user': '?1',
    'sec-gpc': '1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
  };

  if (isZipper) {
    headers['cookie'] = generateZipperCookies();
  }

  return headers;
}

/**
 * Robust Zipper Token & URL Extractor
 */
function extractPureZipperUrl(input) {
  if (!input) return '';
  let str = String(input).trim();

  for (let i = 0; i < 4; i++) {
    if (str.includes('%3A') || str.includes('%2F') || str.includes('%3F') || str.includes('%3D') || str.includes('%2B')) {
      try {
        const dec = decodeURIComponent(str);
        if (dec === str) break;
        str = dec;
      } catch (_) { break; }
    }
  }

  let token = str;
  if (str.includes('?url=')) {
    const parts = str.split('?url=');
    token = parts[parts.length - 1];
  } else if (str.includes('&url=')) {
    const parts = str.split('&url=');
    token = parts[parts.length - 1];
  }

  token = token.replace(/^[./\s]+/, '').trim();

  while (token.includes('codedew.com/zipper/?url=')) {
    token = token.split('codedew.com/zipper/?url=').pop();
    token = token.replace(/^[./\s]+/, '').trim();
  }

  token = token.replace(/ /g, '+');

  return `https://codedew.com/zipper/?url=${encodeURIComponent(token)}`;
}

/**
 * Fast Fetch HTML helper with proxy & anti-bot support
 */
async function fetchHTML(url, isZipper = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  const fetchOptions = {
    headers: getHeaders(isZipper),
    signal: controller.signal
  };

  const agent = getProxyAgent();
  if (agent) {
    fetchOptions.dispatcher = agent;
  }

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeout);

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.text();
  } catch (err) {
    clearTimeout(timeout);
    if (fetchOptions.dispatcher) {
      try {
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 8000);
        const retryRes = await fetch(url, { headers: getHeaders(isZipper), signal: retryController.signal });
        clearTimeout(retryTimeout);
        if (retryRes.ok) return await retryRes.text();
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * Complete 2-Step Zipper Link Resolver
 */
async function resolveZipperUrl(inputUrl) {
  try {
    if (!inputUrl || (!inputUrl.includes('zipper') && !inputUrl.includes('codedew'))) {
      return { url: inputUrl, isZipper: false, isResolved: false };
    }

    const cleanFetchUrl = extractPureZipperUrl(inputUrl);

    const cached = getCached(`zipper:${cleanFetchUrl}`);
    if (cached) return cached;

    let html = await fetchHTML(cleanFetchUrl, true);
    let $ = cheerio.load(html);
    let result = null;

    let iframeSrc = $('iframe').attr('src');
    if (iframeSrc && !iframeSrc.includes('ads') && !iframeSrc.includes('google')) {
      result = {
        url: iframeSrc,
        embedUrl: iframeSrc,
        type: 'embed',
        provider: iframeSrc.includes('razorshell') ? 'razorshell' : 'iframe',
        isResolved: true,
        originalZipperUrl: cleanFetchUrl
      };
    } else {
      let dataHref = $('#goBtn').attr('data-href');
      if (dataHref) {
        if (dataHref.startsWith('http')) {
          result = {
            url: dataHref,
            directUrl: dataHref,
            type: 'direct_download',
            provider: dataHref.includes('mega.nz') ? 'mega' : dataHref.includes('drive.google') ? 'gdrive' : 'direct',
            isResolved: true,
            originalZipperUrl: cleanFetchUrl
          };
        } else if (dataHref.startsWith('/')) {
          const step2Url = `https://codedew.com${dataHref}`;
          html = await fetchHTML(step2Url, true);
          $ = cheerio.load(html);

          iframeSrc = $('iframe').attr('src');
          if (iframeSrc && !iframeSrc.includes('ads')) {
            result = {
              url: iframeSrc,
              embedUrl: iframeSrc,
              type: 'embed',
              provider: 'iframe',
              isResolved: true,
              originalZipperUrl: cleanFetchUrl
            };
          } else {
            dataHref = $('#goBtn').attr('data-href');
            if (dataHref && dataHref.startsWith('http')) {
              result = {
                url: dataHref,
                directUrl: dataHref,
                type: 'direct_download',
                provider: dataHref.includes('mega.nz') ? 'mega' : dataHref.includes('drive.google') ? 'gdrive' : 'direct',
                isResolved: true,
                originalZipperUrl: cleanFetchUrl
              };
            }
          }
        }
      }
    }

    if (result) {
      setCache(`zipper:${cleanFetchUrl}`, result, 3600);
      return result;
    }

    return { url: cleanFetchUrl, isResolved: false, message: 'Could not extract stream link' };
  } catch (err) {
    return { url: inputUrl, isResolved: false, error: err.message };
  }
}

/**
 * Fast Parse Articles
 */
function parseArticles($, pageNumber = 1, isSearch = false, query = '') {
  const results = [];
  const pageText = $('body').text();

  if (isSearch && (pageText.includes('No results found') || pageText.includes('Apologies, but no results were found'))) {
    return {
      success: true,
      query,
      page: Number(pageNumber),
      hasNextPage: false,
      nextPage: null,
      prevPage: pageNumber > 1 ? Number(pageNumber) - 1 : null,
      totalResults: 0,
      message: `No anime found for query "${query}"`,
      data: []
    };
  }

  $('article').each((_, el) => {
    const article = $(el);
    const classAttr = article.attr('class') || '';

    const titleEl = article.find('.entry-title a, h2 a, h3 a').first();
    const title = titleEl.text().trim() || article.find('.herald-post-thumbnail a').attr('title') || '';
    const link = titleEl.attr('href') || article.find('.herald-post-thumbnail a').attr('href') || '';

    if (!title && !link) return;

    const idMatch = classAttr.match(/post-(\d+)/);
    const id = idMatch ? idMatch[1] : null;

    let slug = '';
    if (link) {
      const match = link.match(/rareanimes\.(?:foo|mov)\/(?:[^/]+\/)?([^/]+)\/?$/);
      slug = match ? match[1] : link.split('/').filter(Boolean).pop() || '';
    }

    const imgEl = article.find('.herald-post-thumbnail img, img').first();
    let image = imgEl.attr('src') || imgEl.attr('data-src') || '';
    const srcset = imgEl.attr('srcset');
    if (srcset) {
      const sources = srcset.split(',').map(s => s.trim().split(' '));
      if (sources.length > 0) image = sources[sources.length - 1][0] || image;
    }

    const categories = [];
    article.find('.meta-category a').each((_, cat) => categories.push($(cat).text().trim()));
    if (categories.length === 0) {
      const catMatches = classAttr.match(/category-([a-zA-Z0-9-]+)/g);
      if (catMatches) catMatches.forEach(c => categories.push(c.replace('category-', '')));
    }

    const languages = [];
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('hindi') || classAttr.includes('hindi')) languages.push('Hindi');
    if (lowerTitle.includes('tamil') || classAttr.includes('tamil')) languages.push('Tamil');
    if (lowerTitle.includes('telugu') || classAttr.includes('telugu')) languages.push('Telugu');
    if (lowerTitle.includes('eng') || classAttr.includes('english')) languages.push('English');
    if (lowerTitle.includes('japanese') || classAttr.includes('japanese')) languages.push('Japanese');
    if (lowerTitle.includes('malayalam') || classAttr.includes('malayalam')) languages.push('Malayalam');
    if (lowerTitle.includes('bengali') || classAttr.includes('bengali')) languages.push('Bengali');

    const qualities = [];
    if (/4k|2160p/i.test(title)) qualities.push('4K');
    if (/1080p|fhd/i.test(title)) qualities.push('1080p FHD');
    if (/720p|hd/i.test(title)) qualities.push('720p HD');
    if (/480p|sd/i.test(title)) qualities.push('480p');
    if (/360p/i.test(title)) qualities.push('360p');

    const isMovie = lowerTitle.includes('movie') || classAttr.includes('movies');
    const type = isMovie ? 'Movie' : 'Series';
    const seasonMatch = title.match(/Season\s*(\d+|0\d+)|S(\d+)/i);
    const season = seasonMatch ? (seasonMatch[1] || seasonMatch[2]) : null;
    const date = article.find('.entry-date, .post-date, time').text().trim() || null;
    const isSticky = classAttr.includes('sticky');

    results.push({
      id,
      title,
      slug,
      link,
      image,
      type,
      season: season ? `Season ${parseInt(season, 10)}` : null,
      quality: qualities.length > 0 ? qualities : ['HD'],
      languages: [...new Set(languages)],
      categories: [...new Set(categories)],
      date,
      isSticky
    });
  });

  const hasNextPage = Boolean(
    $('link[rel="next"]').length > 0 || 
    $('.herald-pagination .next').length > 0 || 
    $('.herald-pagination a:contains("Next")').length > 0 ||
    $('.herald-pagination a:contains("»")').length > 0
  );

  const responseObj = {
    success: true,
    page: Number(pageNumber),
    hasNextPage,
    nextPage: hasNextPage ? Number(pageNumber) + 1 : null,
    prevPage: pageNumber > 1 ? Number(pageNumber) - 1 : null,
    totalResults: results.length,
    data: results
  };

  if (isSearch) responseObj.query = query;
  return responseObj;
}

// ----------------------------------------------------
// 🌟 API ROUTES
// ----------------------------------------------------

/**
 * 0. Documentation / Health Check
 */
app.get(['/', '/health'], (req, res) => {
  res.json({
    status: 'Online',
    name: 'RareAnimes High-Speed API (Sevalla, Vercel & Heroku Ready)',
    developer: 'Sujal Chavda (@ChavdaSujal)',
    version: '4.1.0',
    platform: process.env.SEVALLA ? 'Sevalla' : process.env.VERCEL ? 'Vercel' : process.env.HEROKU ? 'Heroku' : 'NodeJS',
    proxiesConfigured: proxyPool.length,
    endpoints: {
      home: '/api/home?page=1',
      search: '/api/search?q=naruto&page=1',
      anime_details: '/api/anime/tomb-raider-king-season-1-hindi-dubbed-episodes-download-hd',
      unwrap_zipper: '/api/unwrap?url=https://codedew.com/zipper/?url=...'
    }
  });
});

/**
 * 1. Home Endpoint with Dynamic Pagination & 5-Min Cache
 */
app.get(['/api/home', '/api/home/:page'], async (req, res) => {
  try {
    const page = parseInt(req.params.page || req.query.page || '1', 10);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ success: false, error: 'Invalid page number. Page must be >= 1.' });
    }

    const cacheKey = `home:${page}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json({ ...cachedData, cached: true });
    }

    const targetUrl = page === 1 ? `${BASE_URL}/home/` : `${BASE_URL}/home/page/${page}/`;
    const html = await fetchHTML(targetUrl, false);
    const $ = cheerio.load(html);
    const data = parseArticles($, page, false);

    setCache(cacheKey, data, 300);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: 'Failed to fetch home page data', message: error.message });
  }
});

/**
 * 2. Search Endpoint with Pagination & 10-Min Cache
 */
app.get(['/api/search', '/api/search/:query', '/api/search/:query/:page'], async (req, res) => {
  try {
    const query = req.params.query || req.query.q || req.query.s || '';
    const page = parseInt(req.params.page || req.query.page || '1', 10);

    if (!query.trim()) {
      return res.status(400).json({ success: false, error: 'Search query is required. Example: /api/search?q=naruto' });
    }

    const cacheKey = `search:${query.toLowerCase()}:${page}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json({ ...cachedData, cached: true });
    }

    const targetUrl = page === 1
      ? `${BASE_URL}/?s=${encodeURIComponent(query)}`
      : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;

    const html = await fetchHTML(targetUrl, false);
    const $ = cheerio.load(html);
    const data = parseArticles($, page, true, query);

    setCache(cacheKey, data, 600);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: 'Failed to execute search', message: error.message });
  }
});

/**
 * 3. Zipper URL Unwrapper Endpoint
 */
app.all(['/api/unwrap', '/api/resolve'], async (req, res) => {
  try {
    let inputUrl = req.query.url || req.body.url;

    if (!inputUrl && req.originalUrl.includes('url=')) {
      const idx = req.originalUrl.indexOf('url=');
      inputUrl = req.originalUrl.substring(idx + 4);
    }

    if (!inputUrl) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required. Example: /api/unwrap?url=https://codedew.com/zipper/?url=...'
      });
    }

    const cleanUrl = extractPureZipperUrl(inputUrl);
    const resolved = await resolveZipperUrl(cleanUrl);

    res.json({
      success: resolved.isResolved !== false,
      zipper_url: cleanUrl,
      real_url: resolved.url,
      type: resolved.type || 'unknown',
      provider: resolved.provider || 'unknown',
      details: resolved
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to unwrap zipper URL', message: error.message });
  }
});

/**
 * 4. Anime Details & Clean Structured Episodes (with Direct Embed Resolver)
 */
app.get('/api/anime/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const cacheKey = `anime:${slug}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json({ ...cachedData, cached: true });
    }

    const targetUrl = `${BASE_URL}/hindi/${slug}/`;
    let html;
    try {
      html = await fetchHTML(targetUrl, false);
    } catch (err) {
      html = await fetchHTML(`${BASE_URL}/${slug}/`, false);
    }

    const $ = cheerio.load(html);
    const title = $('h1.entry-title').text().trim() || $('title').text().trim();
    const thumbnail = $('.entry-content img, .herald-post-thumbnail img').first().attr('src') || '';
    
    // Extract Info
    const info = {};
    const synopsisArr = [];

    $('.entry-content p, .entry-content div').each((_, el) => {
      const text = $(el).text().trim();
      if (!text) return;

      if (text.includes('Full Name:')) {
        const m = text.match(/Full Name:\s*([^\n]+)/i);
        if (m) info.fullName = m[1].trim();
      }
      if (text.includes('Season:')) {
        const m = text.match(/Season:\s*([^\n]+)/i);
        if (m) info.season = m[1].trim();
      }
      if (text.includes('Release Year:')) {
        const m = text.match(/Release Year:\s*([^\n]+)/i);
        if (m) info.releaseYear = m[1].trim();
      }
      if (text.includes('RunTime:')) {
        const m = text.match(/RunTime:\s*([^\n]+)/i);
        if (m) info.runtime = m[1].trim();
      }
      if (text.includes('Genre:')) {
        const m = text.match(/Genre:\s*([^\n]+)/i);
        if (m) info.genre = m[1].trim();
      }
      if (text.includes('Language:')) {
        const m = text.match(/Language:\s*([^\n]+)/i);
        if (m) info.languages = m[1].trim();
      }
      if (text.includes('Quality:')) {
        const m = text.match(/Quality:\s*([^\n]+)/i);
        if (m) info.quality = m[1].trim();
      }
      if (text.includes('Synopsis:')) {
        const m = text.match(/Synopsis:\s*([\s\S]+)/i);
        if (m) synopsisArr.push(m[1].split('Episode')[0].trim());
      }
    });

    // Parse Episodes (Universal Support: handles standard, parenthesized e.g. Episode 01 (373), and Movies)
    const episodes = [];
    let currentEpisode = null;

    $('.entry-content p, .entry-content h3, .entry-content h4, .entry-content div').each((_, el) => {
      // Get text without link tags
      const text = $(el).clone().children('a').remove().end().text().trim();
      
      const isEpisodeHeading = /^Episode\s*(\d+)/i.test(text) && 
        !text.includes('[HubCloud]') && 
        !text.includes('[WatchNow]') && 
        !text.includes('[StreamBeta]') && 
        !text.includes('[DLBeta]') && 
        !text.includes('[Mega]') && 
        !text.includes('Untouched') &&
        !text.includes('Multi Audio');

      if (isEpisodeHeading) {
        const epMatch = text.match(/^Episode\s*(\d+)(?:\s*\([^)]+\))?(?:\s*[–\-:]\s*(.+))?/i);
        const epNum = epMatch ? parseInt(epMatch[1], 10) : episodes.length + 1;
        let epName = epMatch && epMatch[2] ? epMatch[2].replace(/NEw!/i, '').trim() : `Episode ${epNum}`;

        const exists = episodes.find(e => e.episode_number === epNum);
        if (!exists) {
          currentEpisode = {
            id: epNum,
            episode_number: epNum,
            title: text.replace(/NEw!/i, '').trim(),
            name: epName,
            real_url: null,
            zipper_url: null,
            server: 'WatchMultiQuality'
          };
          episodes.push(currentEpisode);
        } else {
          currentEpisode = exists;
        }
      } else if (currentEpisode) {
        $(el).find('a').each((_, a) => {
          const linkText = $(a).text().trim();
          const href = $(a).attr('href') || '';
          if (href && (href.includes('zipper') || href.includes('codedew.com'))) {
            if (linkText.toLowerCase().includes('watchmult')) {
              currentEpisode.zipper_url = extractPureZipperUrl(href);
              currentEpisode.server = linkText;
            } else if (!currentEpisode.zipper_url) {
              currentEpisode.zipper_url = extractPureZipperUrl(href);
              currentEpisode.server = linkText;
            }
          }
        });
      }
    });

    // Movie Fallback (if no episode headings exist)
    if (episodes.length === 0) {
      let movieZipperUrl = null;
      let movieServer = 'WatchMultiQuality';
      $('.entry-content a').each((_, a) => {
        const linkText = $(a).text().trim();
        const href = $(a).attr('href') || '';
        if (href && (href.includes('zipper') || href.includes('codedew.com'))) {
          if (linkText.toLowerCase().includes('watchmult')) {
            movieZipperUrl = extractPureZipperUrl(href);
            movieServer = linkText;
          } else if (!movieZipperUrl && (linkText.toLowerCase().includes('stream') || linkText.toLowerCase().includes('watch'))) {
            movieZipperUrl = extractPureZipperUrl(href);
            movieServer = linkText;
          }
        }
      });

      if (movieZipperUrl) {
        episodes.push({
          id: 1,
          episode_number: 1,
          title: title || 'Full Movie',
          name: 'Full Movie',
          real_url: null,
          zipper_url: movieZipperUrl,
          server: movieServer
        });
      }
    }

    // Filter to only episodes that have a valid zipper URL
    const validEpisodes = episodes.filter(ep => Boolean(ep.zipper_url));

    // Concurrently resolve URLs in chunks of 5
    if (validEpisodes.length > 0) {
      const batchSize = 6;
      for (let i = 0; i < validEpisodes.length; i += batchSize) {
        const chunk = validEpisodes.slice(i, i + batchSize);
        await Promise.all(
          chunk.map(async (ep) => {
            try {
              const resolved = await resolveZipperUrl(ep.zipper_url);
              ep.real_url = resolved.url || ep.zipper_url;
              ep.provider = resolved.provider || 'razorshell';
            } catch (_) {
              ep.real_url = ep.zipper_url;
            }
          })
        );
      }
    }

    const finalResponse = {
      success: true,
      slug,
      title,
      thumbnail,
      info,
      synopsis: synopsisArr.join(' ').trim(),
      totalEpisodes: validEpisodes.length,
      episodes: validEpisodes
    };

    setCache(cacheKey, finalResponse, 1800);
    res.json(finalResponse);
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: 'Failed to fetch anime details',
      message: error.message
    });
  }
});

module.exports = app;
