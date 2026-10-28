import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';

const env = {
  ALLOWED_ORIGINS: 'https://timmybirds.github.io',
  SITE_BASE_URL: 'https://timmybirds.github.io/discovery-school',
  GITHUB_REPO: 'timmyBirds/discovery-school-feedback',
  GITHUB_TOKEN: 'private-test-token',
  REVIEW_ACCESS_KEY: 'review-test-code',
};
const origin = 'https://timmybirds.github.io';
const url = 'https://feedback.example/reviews';

function request(method, body, code = env.REVIEW_ACCESS_KEY, requestOrigin = origin) {
  return new Request(url, {
    method,
    headers: {
      Origin: requestOrigin,
      Authorization: `Bearer ${code}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('rejects unapproved origins and access codes', async () => {
  assert.equal((await worker.fetch(request('GET', null, env.REVIEW_ACCESS_KEY, 'https://untrusted.example'), env)).status, 403);
  const response = await worker.fetch(request('GET', null, 'wrong-code'), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
});

test('creates an issue and returns the comment for the review page', async () => {
  const originalFetch = globalThis.fetch;
  let savedIssue;
  globalThis.fetch = async (input, options) => {
    assert.match(input, /api\.github\.com\/repos\/timmyBirds\/discovery-school-feedback\/issues/);
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    if (options.method === 'POST') {
      savedIssue = { ...JSON.parse(options.body), number: 42, html_url: 'https://github.com/example/issues/42', state: 'open' };
      return Response.json(savedIssue);
    }
    return Response.json([savedIssue]);
  };
  try {
    const feedback = {
      message: 'English should lead; keep French and Kirundi visible.',
      anchors: [
        { page: 'index.html', selector: '#main > section:nth-of-type(1) p:nth-of-type(2)', label: 'Three languages' },
        { page: 'academics.html', selector: '#english p:nth-of-type(1)', label: 'Trilingual learning' },
      ],
      version: 'a'.repeat(40),
    };
    const created = await worker.fetch(request('POST', feedback), env);
    assert.equal(created.status, 201);
    assert.equal((await created.json()).review.id, 42);
    assert.match(savedIssue.body, /English should lead/);
    assert.match(savedIssue.body, /academics\.html/);
    const listed = await worker.fetch(request('GET'), env);
    const reviews = (await listed.json()).reviews;
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].anchors.length, 2);
    assert.equal(reviews[0].message, feedback.message);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects invalid feedback without contacting GitHub', async () => {
  const response = await worker.fetch(request('POST', { message: ' ', anchors: [] }), env);
  assert.equal(response.status, 400);
});
