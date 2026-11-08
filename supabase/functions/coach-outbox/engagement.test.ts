import assert from 'node:assert/strict';
import { healthWord } from '../_shared/messaging.ts';
import { askWorthy, referralText, surveyText, testimonialText, whyText } from './engagement.ts';

Deno.test('asks follow real milestones, not the first session', () => {
  assert.ok(askWorthy('sessions:10') && askWorthy('sessions:50') && askWorthy('sessions:150') && askWorthy('streak:8') && askWorthy('first_pr'));
  assert.ok(!askWorthy('sessions:1') && !askWorthy('sessions:5') && !askWorthy('streak:4'));
  assert.equal(whyText('sessions:25'), 'Congrats on 25 sessions,');
  assert.equal(whyText('streak:12'), '12 weeks in a row,');
});

Deno.test('messages carry the link, fit a text, and say nothing about health', () => {
  const link = 'https://x.example/s/00000000-0000-0000-0000-000000000000';
  for (const m of [surveyText('Ana', 'Emmet', link, true), surveyText('Ana', 'Emmet', link, false),
    testimonialText('Ana', 'Emmet', whyText('sessions:25'), link), referralText('Ana', 'Emmet', link)]) {
    assert.ok(m.includes(link));
    assert.ok(m.length <= 320, m);
    assert.equal(healthWord(m), null);
  }
  assert.ok(surveyText('Ana', 'Emmet', link, true).includes('Reply with a number'));
  assert.ok(!surveyText('Ana', 'Emmet', link, false).includes('Reply with a number'));
});
