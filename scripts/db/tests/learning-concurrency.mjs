import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Only the disposable local Docker database is reachable through this harness.
const args = ['exec', '-i', 'supabase_db_corelia-app', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
const sql = input => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 20_000 }).trim();
const id = `learning-concurrency-${randomUUID()}`;
const user = randomUUID();
const learner = randomUUID();
const sessions = [];
class Session {
  constructor(name) {
    this.name = name;
    this.output = '';
    this.process = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.process.stdout.on('data', data => { this.output += data; this.check?.(); });
    this.process.stderr.on('data', data => { this.output += data; });
    this.process.on('close', code => { this.closed = true; this.reject?.(new Error(`Session closed (${code}): ${this.output}`)); });
    this.process.on('error', error => this.reject?.(error));
    sessions.push(this);
  }
  exec(statement) {
    assert(!this.check, 'Only one pending command per session');
    const marker = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(`Session timeout: ${this.name}`)), 20_000);
      const finish = error => { clearTimeout(timer); this.check = null; this.reject = null; if (error) reject(error); else resolve(); };
      this.reject = finish;
      this.check = () => { if (this.output.includes(marker)) finish(); };
      this.process.stdin.write(`${statement}\nSELECT '${marker}';\n`);
    });
  }
  async begin(profile = user) {
    await this.exec(`SET application_name='${this.name}'; SET statement_timeout='15s'; BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${profile}',true);`);
  }
  close() { if (!this.closed) this.process.stdin.end('ROLLBACK;\n\\q\n'); }
}
async function waitForBlock(name) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND cardinality(pg_blocking_pids(pid))>0;`) === '1') return;
    await delay(50);
  }
  throw new Error(`No observed database lock wait for ${name}`);
}
const publish = `UPDATE public.course_lessons SET published=true WHERE course_id='${id}' AND id='lesson';`;
const invalidateLocale = `UPDATE public.course_lesson_locales SET data=data||'{"resources":[{"title":"Reference","url":""}]}' WHERE course_id='${id}' AND lesson_id='lesson' AND locale='en';`;
let created = false;
try {
  sql(`BEGIN;
    INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('${user}','${user}@corelia.local','{"full_name":"Learning Concurrency Instructor"}');
    INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('${learner}','${learner}@corelia.local','{"full_name":"Learning Concurrency Learner"}');
    UPDATE public.profiles SET role='instructor' WHERE id='${user}';
    INSERT INTO public.courses(id,slug,instructor_id,published,data) VALUES('${id}','${id}','${user}',false,'{"title":"Concurrency fixture","final_assignment_title":"Project","final_assignment_instructions":"Submit notes","final_assignment_fields":["notes"]}');
    INSERT INTO public.course_sections(course_id,id,data) VALUES('${id}','section','{"title":"Section"}');
    INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('${id}','lesson','section',false,'{"title":"Article","lesson_format":"article","description_markdown":"Valid article"}');
    INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES('${id}','lesson','en','{"title":"Valid copy","resources":[]}');
    COMMIT;`);
  created = true;

  // A lesson inserted before section deletion must participate in the guards.
  sql(`INSERT INTO public.course_sections(course_id,id,data) VALUES('${id}','insert-first-section','{"title":"Insert first"}');`);
  const lessonFirst = new Session(`lesson-first-${user}`);
  const sectionSecond = new Session(`section-second-${user}`);
  await lessonFirst.begin();
  await sectionSecond.begin();
  await lessonFirst.exec(`INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('${id}','new-published','insert-first-section',true,'{"title":"Published concurrently","lesson_format":"article","description_markdown":"Keep this lesson"}');`);
  const sectionResult = sectionSecond.exec(`SELECT public.learning_delete_section('${id}','insert-first-section'); COMMIT;`).then(() => null, error => error);
  await waitForBlock(sectionSecond.name);
  await lessonFirst.exec('COMMIT;');
  assert.match(String(await sectionResult), /ARCHIVE_LESSON_REQUIRED/);
  assert.equal(sql(`SELECT count(*) FROM public.course_lessons WHERE course_id='${id}' AND id='new-published' AND published;`), '1');
  assert.equal(sql(`SELECT count(*) FROM public.course_sections WHERE course_id='${id}' AND id='insert-first-section';`), '1');
  console.log('PASS: section deletion waits for a concurrent lesson insert and preserves the published lesson');
  // Keep this fixture from changing the later course completion denominator.
  sql(`UPDATE public.course_lessons SET published=false WHERE course_id='${id}' AND id='new-published';`);

  sql(`INSERT INTO public.course_sections(course_id,id,data) VALUES('${id}','delete-first-section','{"title":"Delete first"}');
    INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('${id}','old-draft','delete-first-section',false,'{"title":"Draft","lesson_format":"article"}');`);
  const sectionFirst = new Session(`section-first-${user}`);
  const lessonSecond = new Session(`lesson-second-${user}`);
  await sectionFirst.begin();
  await lessonSecond.begin();
  await sectionFirst.exec(`SELECT public.learning_delete_section('${id}','delete-first-section');`);
  const lessonResult = lessonSecond.exec(`INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('${id}','late-draft','delete-first-section',false,'{"title":"Late draft","lesson_format":"article"}'); COMMIT;`).then(() => null, error => error);
  await waitForBlock(lessonSecond.name);
  await sectionFirst.exec('COMMIT;');
  assert.match(String(await lessonResult), /foreign key constraint/);
  assert.equal(sql(`SELECT count(*) FROM public.course_lessons WHERE course_id='${id}' AND section_id='delete-first-section';`), '0');
  assert.equal(sql(`SELECT count(*) FROM public.course_sections WHERE course_id='${id}' AND id='delete-first-section';`), '0');
  console.log('PASS: a late lesson insert waits for section deletion and fails without leaving an orphan');

  const publisher = new Session(`publish-${user}`);
  const editor = new Session(`edit-${user}`);
  await publisher.begin();
  await editor.begin();
  await publisher.exec(publish);
  const editResult = editor.exec(`${invalidateLocale} COMMIT;`).then(() => null, error => error);
  await waitForBlock(editor.name);
  await publisher.exec('COMMIT;');
  assert.match(String(await editResult), /resource_url_invalid/);
  assert.equal(sql(`SELECT data->'resources' FROM public.course_lesson_locales WHERE course_id='${id}' AND lesson_id='lesson' AND locale='en';`), '[]');
  console.log('PASS: locale edit waits for publication, then invalid edit rolls back');

  sql(`UPDATE public.course_lessons SET published=false WHERE course_id='${id}' AND id='lesson';`);
  const firstEditor = new Session(`edit-first-${user}`);
  const secondPublisher = new Session(`publish-second-${user}`);
  await firstEditor.begin();
  await secondPublisher.begin();
  await firstEditor.exec(invalidateLocale);
  const publishResult = secondPublisher.exec(`${publish} COMMIT;`).then(() => null, error => error);
  await waitForBlock(secondPublisher.name);
  await firstEditor.exec('COMMIT;');
  assert.match(String(await publishResult), /resource_url_invalid/);
  assert.equal(sql(`SELECT published FROM public.course_lessons WHERE course_id='${id}' AND id='lesson';`), 'f');
  console.log('PASS: publication waits for locale edit, then invalid publication rolls back');

  sql(`INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('${id}','practice-mapping','section',false,'{"title":"Practice","lesson_format":"practice","description_markdown":"Submit notes","practice_config":{"mode":"submission","submission_fields":["notes"]}}');`);
  const publishPractice = `UPDATE public.course_lessons SET published=true WHERE course_id='${id}' AND id='practice-mapping';`;
  const removeFinalField = `UPDATE public.courses SET data=jsonb_set(data,'{final_assignment_fields}','[]') WHERE id='${id}';`;
  const practiceFirst = new Session(`practice-first-${user}`);
  const finalSecond = new Session(`final-settings-second-${user}`);
  await practiceFirst.begin();
  await finalSecond.begin();
  await practiceFirst.exec(publishPractice);
  const finalSettingsResult = finalSecond.exec(`${removeFinalField} COMMIT;`).then(() => null, error => error);
  await waitForBlock(finalSecond.name);
  await practiceFirst.exec('COMMIT;');
  assert.match(String(await finalSettingsResult), /invalid_final_artifact_mapping/);
  assert.equal(sql(`SELECT data->'final_assignment_fields' FROM public.courses WHERE id='${id}';`), '["notes"]');
  console.log('PASS: final settings wait for practice publication and cannot remove its required field');

  sql(`UPDATE public.course_lessons SET published=false WHERE course_id='${id}' AND id='practice-mapping';`);
  const finalSettingsFirst = new Session(`final-settings-first-${user}`);
  const practiceSecond = new Session(`practice-second-${user}`);
  await finalSettingsFirst.begin();
  await practiceSecond.begin();
  await finalSettingsFirst.exec(removeFinalField);
  const practiceMappingResult = practiceSecond.exec(`${publishPractice} COMMIT;`).then(() => null, error => error);
  await waitForBlock(practiceSecond.name);
  await finalSettingsFirst.exec('COMMIT;');
  assert.match(String(await practiceMappingResult), /invalid_final_artifact_mapping/);
  assert.equal(sql(`SELECT published FROM public.course_lessons WHERE course_id='${id}' AND id='practice-mapping';`), 'f');
  sql(`DELETE FROM public.course_lessons WHERE course_id='${id}' AND id='practice-mapping'; UPDATE public.courses SET data=jsonb_set(data,'{final_assignment_fields}','["notes"]') WHERE id='${id}';`);
  console.log('PASS: practice publication waits for final settings and rejects a removed artifact field');

  const questionId = `question-${user}`;
  sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);
    SELECT public.learning_save_lesson('${id}','{"id":"quiz","section_id":"section","title":"Concurrent quiz","lesson_format":"quiz","published":true,"quiz_config":{"allow_retry":false,"passing_ratio":0.7}}','[{"id":"${questionId}","order":0,"type":"mcq","question":"Choose A","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]');
    UPDATE public.courses SET published=true WHERE id='${id}'; COMMIT;`);
  const request = randomUUID();
  const quizCall = answer => `DO $$ DECLARE result jsonb; BEGIN
    result:=public.learning_quiz_submit('${id}','quiz','${request}','{"${questionId}":${answer}}');
    IF result->>'attempt_group_id'<>'${request}' OR result->>'passed'<>'true' OR result->>'correct'<>'1' OR result->>'completed'<>'true' THEN RAISE EXCEPTION 'incorrect replay result: %',result; END IF;
  END $$;`;
  const firstSubmit = new Session(`quiz-first-${user}`);
  const replaySubmit = new Session(`quiz-replay-${user}`);
  await firstSubmit.begin(learner);
  await replaySubmit.begin(learner);
  await firstSubmit.exec(quizCall(0));
  // Same request ID represents the first payload even if a client changes its answers.
  const replayResult = replaySubmit.exec(`${quizCall(1)} COMMIT;`).then(() => null, error => error);
  await waitForBlock(replaySubmit.name);
  const competingSubmit = new Session(`quiz-competing-${user}`);
  await competingSubmit.begin(learner);
  const competingQuizResult = competingSubmit.exec(`SELECT public.learning_quiz_submit('${id}','quiz','${randomUUID()}','{"${questionId}":0}'); COMMIT;`).then(() => null, error => error);
  await waitForBlock(competingSubmit.name);
  const questionEdit = new Session(`question-after-submit-${user}`);
  await questionEdit.begin();
  const questionEditResult = questionEdit.exec(`UPDATE public.course_section_questions SET data=jsonb_set(data,'{correct_index}','1') WHERE id='${questionId}'; COMMIT;`).then(() => null, error => error);
  await waitForBlock(questionEdit.name);
  await firstSubmit.exec('COMMIT;');
  assert.equal(await replayResult, null);
  assert.match(String(await competingQuizResult), /RETRY_DISABLED/);
  assert.equal(await questionEditResult, null);
  console.log('PASS: a different concurrent quiz request is rejected when retry is disabled');
  console.log('PASS: question editing waits for grading and cannot change the stored result');
  assert.equal(sql(`SELECT count(*)||':'||count(DISTINCT attempt_group_id)||':'||bool_and(is_correct) FROM public.section_question_attempts WHERE course_id='${id}' AND user_id='${learner}';`), '1:1:true');
  assert.equal(sql(`SELECT count(*) FROM public.lesson_progress WHERE course_id='${id}' AND user_id='${learner}' AND completed_at IS NOT NULL;`), '1');
  console.log('PASS: concurrent quiz replay returns the first result with one attempt group and completion');
  // Reverse the ordering: submit must grade the committed question after an edit.
  const editBeforeSubmit = new Session(`question-before-submit-${user}`);
  const submitAfterEdit = new Session(`submit-after-question-${user}`);
  await editBeforeSubmit.begin();
  await submitAfterEdit.begin(user);
  await editBeforeSubmit.exec(`UPDATE public.course_section_questions SET data=jsonb_set(data,'{correct_index}','0') WHERE id='${questionId}';`);
  const submitAfterEditResult = submitAfterEdit.exec(`DO $$ DECLARE result jsonb; BEGIN
    result:=public.learning_quiz_submit('${id}','quiz','${randomUUID()}','{"${questionId}":0}');
    IF result->>'passed'<>'true' THEN RAISE EXCEPTION 'graded stale question: %',result; END IF;
  END $$; COMMIT;`).then(() => null, error => error);
  await waitForBlock(submitAfterEdit.name);
  await editBeforeSubmit.exec('COMMIT;');
  assert.equal(await submitAfterEditResult, null);
  assert.equal(sql(`SELECT count(*)||':'||bool_and(is_correct) FROM public.section_question_attempts WHERE course_id='${id}' AND user_id='${user}';`), '1:true');
  console.log('PASS: grading waits for question editing and uses the committed answer key');


  assert.equal(sql(`SELECT completed_at IS NULL FROM public.enrollments WHERE course_id='${id}' AND user_id='${learner}';`), 't');
  const finalRequest = randomUUID();
  const competingRequest = randomUUID();
  const finalCall = (requestId, content) => `SELECT public.learning_final_submit('${id}','${content}','[]','{"notes":"Local QA"}','${requestId}');`;
  const finalFirst = new Session(`final-first-${user}`);
  const finalDuplicate = new Session(`final-duplicate-${user}`);
  const finalCompeting = new Session(`final-competing-${user}`);
  await finalFirst.begin(learner);
  await finalDuplicate.begin(learner);
  await finalCompeting.begin(learner);
  await finalFirst.exec(finalCall(finalRequest, 'First submission'));
  const duplicateResult = finalDuplicate.exec(`${finalCall(finalRequest, 'Changed retry payload')} COMMIT;`).then(() => null, error => error);
  const competingResult = finalCompeting.exec(`${finalCall(competingRequest, 'Competing submission')} COMMIT;`).then(() => null, error => error);
  await waitForBlock(finalDuplicate.name);
  await waitForBlock(finalCompeting.name);
  await finalFirst.exec('COMMIT;');
  assert.equal(await duplicateResult, null);
  assert.match(String(await competingResult), /SUBMISSION_ALREADY_EXISTS/);
  assert.equal(sql(`SELECT count(*) FROM public.final_assignment_submissions WHERE course_id='${id}' AND user_id='${learner}';`), '1');
  assert.equal(sql(`SELECT status||':'||content FROM public.final_assignment_submissions WHERE id='${finalRequest}';`), 'pending:First submission');
  assert.equal(sql(`SELECT completed_at IS NULL FROM public.enrollments WHERE course_id='${id}' AND user_id='${learner}';`), 't');
  console.log('PASS: concurrent final replay is idempotent, competing request rejected, pending blocks completion');

  const rejectFirst = new Session(`reject-first-${user}`);
  const resubmitSecond = new Session(`resubmit-second-${user}`);
  const revisedRequest = randomUUID();
  await rejectFirst.begin();
  await resubmitSecond.begin(learner);
  await rejectFirst.exec(`SELECT public.learning_final_review('${finalRequest}','rejected','Add persistence tests');`);
  const resubmitResult = resubmitSecond.exec(finalCall(revisedRequest, 'Revised submission')).then(() => null, error => error);
  await waitForBlock(resubmitSecond.name);
  await rejectFirst.exec('COMMIT;');
  assert.equal(await resubmitResult, null);
  // The replacement is still uncommitted when a reviewer retries the old review.
  const staleReviewer = new Session(`stale-review-${user}`);
  await staleReviewer.begin();
  const staleResult = staleReviewer.exec(`SELECT public.learning_final_review('${finalRequest}','approved','Stale approval'); COMMIT;`).then(() => null, error => error);
  await waitForBlock(staleReviewer.name);
  await resubmitSecond.exec('COMMIT;');
  assert.match(String(await staleResult), /STALE_SUBMISSION/);
  assert.equal(sql(`SELECT count(*) FROM public.final_assignment_submissions WHERE course_id='${id}' AND user_id='${learner}';`), '2');
  assert.equal(sql(`SELECT status||':'||reviewer_comment FROM public.final_assignment_submissions WHERE id='${finalRequest}';`), 'rejected:Add persistence tests');
  assert.equal(sql(`SELECT status||':'||content FROM public.final_assignment_submissions WHERE id='${revisedRequest}';`), 'pending:Revised submission');
  assert.equal(sql(`SELECT id FROM public.final_assignment_submissions WHERE course_id='${id}' AND user_id='${learner}' ORDER BY submitted_at DESC,id DESC LIMIT 1;`), revisedRequest);
  assert.equal(sql(`SELECT completed_at IS NULL FROM public.enrollments WHERE course_id='${id}' AND user_id='${learner}';`), 't');
  console.log('PASS: resubmission waits for rejection; stale review waits for resubmission and cannot approve the old version');

  const reviewFirst = new Session(`review-first-${user}`);
  const reviewReplay = new Session(`review-replay-${user}`);
  await reviewFirst.begin();
  await reviewReplay.begin();
  const approve = `SELECT public.learning_final_review('${revisedRequest}','approved','Reviewed');`;
  await reviewFirst.exec(`${approve} SELECT 'REVIEWED:'||reviewed_at::text FROM public.final_assignment_submissions WHERE id='${revisedRequest}';`);
  const firstReviewedAt = reviewFirst.output.split('\n').find(line => line.startsWith('REVIEWED:'));
  assert(firstReviewedAt);
  const reviewResult = reviewReplay.exec(`${approve} COMMIT;`).then(() => null, error => error);
  await waitForBlock(reviewReplay.name);
  await reviewFirst.exec('COMMIT;');
  assert.equal(await reviewResult, null);
  assert.equal(sql(`SELECT 'REVIEWED:'||reviewed_at::text FROM public.final_assignment_submissions WHERE id='${revisedRequest}';`), firstReviewedAt);
  assert.equal(sql(`SELECT completed_at IS NOT NULL FROM public.enrollments WHERE course_id='${id}' AND user_id='${learner}';`), 't');
  console.log('PASS: concurrent approval preserves review timestamp and completes the eligible course');


} finally {
  for (const session of sessions) session.close();
  // Closing the psql connections releases any open transaction before cleanup.
  await Promise.all(sessions.filter(session => !session.closed).map(session => new Promise(resolve => session.process.once('close', resolve))));
  if (created) sql(`BEGIN; UPDATE public.courses SET published=false WHERE id='${id}'; DELETE FROM public.final_assignment_submissions WHERE course_id='${id}'; DELETE FROM public.section_question_attempts WHERE course_id='${id}'; DELETE FROM public.lesson_progress WHERE course_id='${id}'; DELETE FROM public.enrollments WHERE course_id='${id}'; UPDATE public.course_lessons SET published=false WHERE course_id='${id}'; DELETE FROM public.course_lessons WHERE course_id='${id}'; DELETE FROM public.courses WHERE id='${id}'; DELETE FROM auth.users WHERE id IN ('${user}','${learner}'); COMMIT;`);
}
