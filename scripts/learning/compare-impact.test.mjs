import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareImpact } from './compare-impact.mjs';
const snapshot = () => ({ report_version: 2, scope: 'local_post_migration_snapshot', lessons: [], attribution: [], completion: [], enrollment_readiness: [] });
describe('impact snapshot comparison', () => {
  it('matches course-scoped lesson IDs and ignores ordering of rows/object fields/issues', () => {
    const before = snapshot(), after = snapshot();
    before.lessons = [{ course_id: 'a', lesson_id: 'same', issues: ['b', 'a'], published: false }, { course_id: 'b', lesson_id: 'same', issues: [], published: false }];
    after.lessons = [{ published: true, issues: [], lesson_id: 'same', course_id: 'b' }, { published: false, lesson_id: 'same', course_id: 'a', issues: ['a', 'b'] }];
    const result = compareImpact(before, after);
    assert.equal(result.changes.lessons.length, 1);
    assert.equal(result.changes.lessons[0].course_id, 'b');
    assert.equal(result.changes.lessons[0].status, 'changed');
    assert.equal(result.changes.lessons[0].before.published, false);
    assert.equal(result.changes.lessons[0].after.published, true);
  });
  it('reports denominator/eligibility changes without treating preserved history as revoked', () => {
    const before = snapshot(), after = snapshot();
    before.completion = [{ course_id: 'a', required_lessons: 2 }];
    after.completion = [{ course_id: 'a', required_lessons: 1 }];
    before.enrollment_readiness = [{ course_id: 'a', user_id: 'u', eligible_now: true, completed_at: 'old' }];
    after.enrollment_readiness = [{ course_id: 'a', user_id: 'u', eligible_now: false, completed_at: 'old' }];
    const result = compareImpact(before, after);
    assert.equal(result.summary.completion, 1);
    assert.equal(result.summary.enrollment_readiness, 1);
    assert.deepEqual(result.history_changes, []);
  });
  it('flags removed enrollment history and changed credential timestamps', () => {
    const before = snapshot(), after = snapshot();
    before.enrollment_readiness = [{ course_id: 'a', user_id: 'u', completed_at: 'old', certificate_issued_at: 'issued' }, { course_id: 'b', user_id: 'u', completed_at: 'old' }];
    after.enrollment_readiness = [{ course_id: 'a', user_id: 'u', completed_at: 'old', certificate_issued_at: 'changed' }];
    const result = compareImpact(before, after);
    assert.deepEqual(result.history_changes, [{ course_id: 'a', user_id: 'u', field: 'certificate_issued_at', before: 'issued', after: 'changed' }, { course_id: 'b', user_id: 'u', field: 'completed_at', before: 'old', after: null }]);
    assert.equal(result.changes.enrollment_readiness[1].status, 'removed');
  });
  it('includes new rows and rejects unsupported or ambiguous snapshots', () => {
    const before = snapshot(), after = snapshot();
    after.attribution = [{ course_id: 'new', instructors: [] }];
    assert.equal(compareImpact(before, after).changes.attribution[0].status, 'added');
    assert.throws(() => compareImpact({ ...before, report_version: 1 }, after), /Invalid v2/);
    after.lessons = [{ course_id: 'a', lesson_id: 'l' }, { course_id: 'a', lesson_id: 'l' }];
    assert.throws(() => compareImpact(before, after), /Duplicate identity/);
  });
});

it('compares pre-migration visibility and feature permissions against the new schema', () => {
  const before = { ...snapshot(), scope: 'local_pre_migration_snapshot', permissions: [{course_id:'a',user_id:'co',content:true,submissions:false}] };
  const after = { ...snapshot(), permissions: [{course_id:'a',user_id:'co',content:true,submissions:false}] };
  before.lessons = [{course_id:'a',lesson_id:'empty',published:true,public_visible:true,issues:[]}];
  after.lessons = [{course_id:'a',lesson_id:'empty',published:false,public_visible:false,issues:['content_required']}];
  const result = compareImpact(before,after);
  assert.deepEqual(result.changes.permissions,[]);
  assert.equal(result.changes.lessons[0].before.public_visible,true);
  assert.equal(result.changes.lessons[0].after.public_visible,false);
  after.permissions[0].submissions=true;
  assert.equal(compareImpact(before,after).summary.permissions,1);
});
