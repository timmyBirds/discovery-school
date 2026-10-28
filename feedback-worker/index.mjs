const marker = '<!-- discovery-review:v1 -->';

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    },
  });
}

function validOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((part) => part.trim());
  return allowed.includes(origin) ? origin : null;
}

function validCode(request, env) {
  const supplied = request.headers.get('Authorization') || '';
  const expected = `Bearer ${env.REVIEW_ACCESS_KEY || ''}`;
  if (!env.REVIEW_ACCESS_KEY || supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid feedback');
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (!message || message.length > 4000) throw new Error('Feedback must be 1–4000 characters');
  if (!Array.isArray(raw.anchors) || raw.anchors.length < 1 || raw.anchors.length > 100) {
    throw new Error('Choose between 1 and 100 locations');
  }
  const anchors = raw.anchors.map((anchor) => {
    if (!anchor || typeof anchor !== 'object') throw new Error('Invalid location');
    const page = String(anchor.page || '');
    const selector = String(anchor.selector || '');
    if (!/^[a-z0-9-]+\.html$/.test(page) || !selector || selector.length > 500) {
      throw new Error('Invalid page location');
    }
    return {
      page,
      selector,
      quote: String(anchor.quote || '').slice(0, 300),
      label: String(anchor.label || '').slice(0, 150),
    };
  });
  const version = /^[0-9a-f]{40}$/.test(raw.version || '') ? raw.version : '';
  return { message, anchors, version, createdAt: new Date().toISOString() };
}

async function github(env, path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'Discovery-School-Review',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  return response.json();
}

function issueBody(review, env) {
  const base = (env.SITE_BASE_URL || '').replace(/\/$/, '');
  const locations = review.anchors.map((anchor) => {
    const url = `${base}/${anchor.page}`;
    return `- [${anchor.page}](${url}) — ${anchor.label.replace(/\n/g, ' ')}`;
  }).join('\n');
  const quoted = review.message.split('\n').map((line) => `> ${line}`).join('\n');
  return `${marker}\n## Feedback\n${quoted}\n\n## Locations\n${locations}\n\nSite version: ${review.version || 'unknown'}\n\n## Delivery\n- [ ] Scope and wording agreed\n- [ ] Website pull request linked here\n- [ ] Automated checks pass\n- [ ] Page preview approved\n- [ ] Pull request merged and issue closed\n\n<!-- review-data:${encodeURIComponent(JSON.stringify(review))} -->`;
}

function extract(issue) {
  if (issue.pull_request || !issue.body?.startsWith(marker)) return null;
  const match = issue.body.match(/<!-- review-data:([^ ]+) -->/);
  if (!match) return null;
  try {
    const review = JSON.parse(decodeURIComponent(match[1]));
    if (!Array.isArray(review.anchors)) return null;
    return { ...review, id: issue.number, url: issue.html_url, state: issue.state };
  } catch { return null; }
}

export default {
  async fetch(request, env) {
    const origin = validOrigin(request, env);
    if (!origin) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
          'Vary': 'Origin',
        },
      });
    }
    if (!validCode(request, env)) return json({ error: 'Incorrect review access code' }, 401, origin);
    if (!env.GITHUB_REPO || !env.GITHUB_TOKEN || !env.SITE_BASE_URL) {
      return json({ error: 'Feedback service is not configured' }, 503, origin);
    }
    if (new URL(request.url).pathname !== '/reviews') return json({ error: 'Not found' }, 404, origin);
    try {
      if (request.method === 'POST') {
        if (Number(request.headers.get('Content-Length') || 0) > 30000) return json({ error: 'Request too large' }, 413, origin);
        const review = normalize(await request.json());
        const title = `[Site feedback] ${review.anchors[0].page}: ${review.message.replace(/\s+/g, ' ').slice(0, 65)}`;
        const issue = await github(env, '/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body: issueBody(review, env) }),
        });
        return json({ review: { ...review, id: issue.number, url: issue.html_url, state: issue.state } }, 201, origin);
      }
      if (request.method === 'GET') {
        const reviews = [];
        for (let page = 1; page <= 10; page += 1) {
          const issues = await github(env, `/issues?state=open&per_page=100&page=${page}`);
          reviews.push(...issues.map(extract).filter(Boolean));
          if (issues.length < 100) break;
        }
        return json({ reviews }, 200, origin);
      }
      return json({ error: 'Method not allowed' }, 405, origin);
    } catch (error) {
      const badInput = error instanceof SyntaxError || /^Invalid|^Feedback|^Choose/.test(error.message);
      return json({ error: badInput ? error.message : 'Feedback service unavailable' }, badInput ? 400 : 502, origin);
    }
  },
};
