/* eslint-disable */
// HTTP 层冒烟：验证真实 HTTP 状态码、错误响应结构（前端依赖 error.response.data.message）
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || '127.0.0.1';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5544';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'online_classroom';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret';
process.env.PORT = process.env.TEST_PORT || '3099';

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DataSource } = require('typeorm');
const jwt = require('jsonwebtoken');
const { User, UserRole } = require('../dist/common/entities/user.entity');
const { Course } = require('../dist/common/entities/course.entity');
const { CourseLesson } = require('../dist/common/entities/course-lesson.entity');
const { CourseEnrollment } = require('../dist/common/entities/course-enrollment.entity');
const { LiveClass, LiveClassStatus } = require('../dist/common/entities/live-class.entity');

const PORT = Number(process.env.PORT);

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  await app.listen(PORT);
  const ds = app.get(DataSource);
  await ds.query('TRUNCATE attendance_records, live_classes, course_lessons, assignment_submissions, assignments, course_enrollments, courses, users RESTART IDENTITY CASCADE');

  const userRepo = ds.getRepository(User);
  const courseRepo = ds.getRepository(Course);
  const lessonRepo = ds.getRepository(CourseLesson);
  const enrollRepo = ds.getRepository(CourseEnrollment);
  const liveRepo = ds.getRepository(LiveClass);

  const teacher = await userRepo.save(userRepo.create({ email: 'h-t@t.com', password: 'x', name: '老师', role: UserRole.TEACHER }));
  const student = await userRepo.save(userRepo.create({ email: 'h-s@a.com', password: 'x', name: '学生', role: UserRole.STUDENT }));
  const outsider = await userRepo.save(userRepo.create({ email: 'h-o@a.com', password: 'x', name: '外人', role: UserRole.STUDENT }));
  const course = await courseRepo.save(courseRepo.create({ name: '课', cover: 'c', description: 'd', category: 'm', status: 'published', teacherId: teacher.id }));
  const lesson = await lessonRepo.save(lessonRepo.create({ title: 'l', order: 1, courseId: course.id }));
  await enrollRepo.save(enrollRepo.create({ studentId: student.id, courseId: course.id }));
  const live = await liveRepo.save(liveRepo.create({ title: '直播', courseId: course.id, lessonId: lesson.id, teacherId: teacher.id, status: LiveClassStatus.SCHEDULED }));

  const tToken = jwt.sign({ sub: teacher.id, role: 'teacher' }, process.env.JWT_SECRET);
  const sToken = jwt.sign({ sub: student.id, role: 'student' }, process.env.JWT_SECRET);
  const oToken = jwt.sign({ sub: outsider.id, role: 'student' }, process.env.JWT_SECRET);
  const base = `http://127.0.0.1:${PORT}`;

  const req = async (path, method, token, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  let failures = 0;
  const check = (cond, msg) => {
    console.log(cond ? `✅ ${msg}` : `❌ ${msg}`);
    if (!cond) failures++;
  };

  // 未开窗
  let r = await req('/attendance/check-in', 'POST', sToken, { liveClassId: live.id });
  check(r.status === 400 && r.data.message?.includes('签到尚未开始'), `未开窗 400: ${r.status} ${JSON.stringify(r.data.message)}`);

  // 教师签到
  r = await req('/attendance/check-in', 'POST', tToken, { liveClassId: live.id });
  check(r.status === 403, '教师签到 403（整次拒绝，不写记录）');

  // 未登录
  r = await req('/attendance/check-in', 'POST', null, { liveClassId: live.id });
  check(r.status === 401, `未登录 401: ${r.status}`);

  // 窗口接口 - scheduled
  r = await req(`/attendance/live-class/${live.id}/window`, 'GET', sToken);
  check(r.status === 200 && r.data.phase === 'not_open' && r.data.canCheckIn === false && typeof r.data.presentDeadline === 'object',
    `窗口接口 not_open: ${JSON.stringify(r.data?.phase)}`);

  // 开始直播
  r = await req(`/live-classes/${live.id}/start`, 'POST', sToken);
  check(r.status === 403, '学生不能开始直播');
  r = await req(`/live-classes/${live.id}/start`, 'POST', tToken);
  check(r.status === 201 && r.data.status === 'live' && r.data.actualStartTime, '教师开始直播 201');

  // 教师签到（开窗后）→ 403
  r = await req('/attendance/check-in', 'POST', tToken, { liveClassId: live.id });
  check(r.status === 403 && r.data.message.includes('教师'), `开窗后教师签到 403: ${r.status} ${r.data.message}`);

  // 未报名 → 403
  r = await req('/attendance/check-in', 'POST', oToken, { liveClassId: live.id });
  check(r.status === 403 && r.data.message.includes('未报名'), `未报名 403: ${r.status} ${r.data.message}`);

  // 出勤签到
  r = await req('/attendance/check-in', 'POST', sToken, { liveClassId: live.id });
  check(r.status === 201 && r.data.repeated === false && r.data.record.status === 'present',
    `出勤签到 201: ${r.status} ${JSON.stringify(r.data)}`);

  // 重复提交
  r = await req('/attendance/check-in', 'POST', sToken, { liveClassId: live.id });
  check(r.status === 201 && r.data.repeated === true && r.data.record.status === 'present',
    `重复提交返回原记录: ${r.status} repeated=${r.data?.repeated}`);

  // 结束直播（不存在的课 404）
  r = await req('/live-classes/00000000-0000-0000-0000-000000000000/end', 'POST', tToken);
  check(r.status === 404, `不存在的直播 404: ${r.status}`);

  // 结束直播
  r = await req(`/live-classes/${live.id}/end`, 'POST', tToken);
  check(r.status === 201 && r.data.liveClass.status === 'ended' && r.data.summary.total === 1,
    `结束直播并返回汇总: ${JSON.stringify(r.data?.summary)}`);

  // 并发重复结束
  const ends = await Promise.all([
    req(`/live-classes/${live.id}/end`, 'POST', tToken),
    req(`/live-classes/${live.id}/end`, 'POST', tToken),
    req(`/live-classes/${live.id}/end`, 'POST', tToken),
  ]);
  const okEnds = ends.filter((e) => e.status === 201).length;
  const conflictEnds = ends.filter((e) => e.status === 409).length;
  check(okEnds === 0 && conflictEnds === 3, `已结束后重复结束全部 409（201:${okEnds}/409:${conflictEnds}）`);

  // 结束后窗口接口回读：学生看到自己 present，summary 一致
  r = await req(`/attendance/live-class/${live.id}/window`, 'GET', sToken);
  check(r.status === 200 && r.data.phase === 'closed' && r.data.myRecord.status === 'present'
    && r.data.summary.total === 1 && r.data.summary.present === 1,
    `结束后窗口回读一致: ${JSON.stringify({ phase: r.data?.phase, s: r.data?.summary })}`);

  // 未报名人结束后查看窗口
  r = await req(`/attendance/live-class/${live.id}/window`, 'GET', oToken);
  check(r.status === 200 && r.data.phase === 'closed' && r.data.myRecord === null && r.data.rejectReason,
    `外人窗口回读 closed+原因: reject=${r.data?.rejectReason}`);

  // 汇总接口
  r = await req(`/attendance/live-class/${live.id}/summary`, 'GET', tToken);
  check(r.status === 200 && r.data.total === 1 && r.data.present === 1, `汇总接口: ${JSON.stringify(r.data)}`);

  console.log(failures === 0 ? '\nHTTP 冒烟全部通过' : `\n${failures} 项失败`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
