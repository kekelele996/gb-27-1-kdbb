/* eslint-disable */
// 端到端集成测试：签到闭环
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || '127.0.0.1';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5544';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'online_classroom';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret';

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DataSource } = require('typeorm');
const {
  AttendanceRecord,
  AttendanceStatus,
} = require('../dist/common/entities/attendance-record.entity');
const { LiveClass, LiveClassStatus } = require('../dist/common/entities/live-class.entity');
const { User, UserRole } = require('../dist/common/entities/user.entity');
const { Course } = require('../dist/common/entities/course.entity');
const { CourseLesson } = require('../dist/common/entities/course-lesson.entity');
const { CourseEnrollment } = require('../dist/common/entities/course-enrollment.entity');
const { AttendanceService } = require('../dist/modules/attendance/attendance.service');
const { LiveClassesService } = require('../dist/modules/live-classes/live-classes.service');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('❌ FAIL:', msg);
  } else {
    passed++;
    console.log('✅ PASS:', msg);
  }
}

async function expectFail(promise, status, messagePart, label) {
  try {
    await promise;
    assert(false, `${label}: 应当被拒绝但成功了`);
  } catch (e) {
    const okStatus = e.status === status;
    const okMsg = !messagePart || String(e.message).includes(messagePart);
    assert(okStatus && okMsg, `${label}: 期望 ${status}/${messagePart}，实际 ${e.status}/${e.message}`);
  }
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const ds = app.get(DataSource);

  // 清理（按外键顺序）
  await ds.query('TRUNCATE attendance_records, live_classes, course_lessons, assignment_submissions, assignments, course_enrollments, courses, users RESTART IDENTITY CASCADE');

  const userRepo = ds.getRepository(User);
  const courseRepo = ds.getRepository(Course);
  const lessonRepo = ds.getRepository(CourseLesson);
  const enrollRepo = ds.getRepository(CourseEnrollment);
  const liveRepo = ds.getRepository(LiveClass);
  const attendanceRepo = ds.getRepository(AttendanceRecord);

  // ---- 种子数据 ----
  const teacher = await userRepo.save(
    userRepo.create({ email: 't@t.com', password: 'x', name: '老师', role: UserRole.TEACHER, teacherStatus: 'approved' }),
  );
  const studentA = await userRepo.save(
    userRepo.create({ email: 'a@a.com', password: 'x', name: '学生甲', role: UserRole.STUDENT }),
  );
  const studentB = await userRepo.save(
    userRepo.create({ email: 'b@b.com', password: 'x', name: '学生乙', role: UserRole.STUDENT }),
  );
  const studentC = await userRepo.save(
    userRepo.create({ email: 'c@c.com', password: 'x', name: '未报名学生', role: UserRole.STUDENT }),
  );

  const course = await courseRepo.save(
    courseRepo.create({
      name: '测试课程', cover: 'c.png', description: 'd', category: 'math',
      type: 'free', status: 'published', teacherId: teacher.id,
    }),
  );
  const lesson = await lessonRepo.save(
    lessonRepo.create({ title: '第1节', order: 1, courseId: course.id, isLive: true }),
  );
  await enrollRepo.save(enrollRepo.create({ studentId: studentA.id, courseId: course.id, enrolledAt: new Date() }));
  await enrollRepo.save(enrollRepo.create({ studentId: studentB.id, courseId: course.id, enrolledAt: new Date() }));

  const attendanceService = app.get(AttendanceService);
  const liveService = app.get(LiveClassesService);

  const live = await liveRepo.save(
    liveRepo.create({
      title: '直播1', courseId: course.id, lessonId: lesson.id,
      teacherId: teacher.id, status: LiveClassStatus.SCHEDULED,
    }),
  );

  // ============ 1. 未开窗：已报名学生签到被拒 ============
  await expectFail(
    attendanceService.checkIn(studentA.id, live.id),
    400, '签到尚未开始', '未开窗时学生签到',
  );

  // 窗口状态：not_open
  let win = await attendanceService.getCheckInWindow(studentA.id, UserRole.STUDENT, live.id);
  assert(win.phase === 'not_open' && win.canCheckIn === false, '窗口状态为 not_open');

  // ============ 2. 教师签到被拒 ============
  // 先开始直播
  const started = await liveService.startLive(teacher.id, live.id);
  assert(started.status === LiveClassStatus.LIVE && !!started.actualStartTime, '直播开始成功');
  await expectFail(
    attendanceService.checkIn(teacher.id, live.id),
    403, '教师', '教师签到被拒',
  );

  // ============ 3. 重复开始直播不改变 actualStartTime（窗口锚点稳定） ============
  const started2 = await liveService.startLive(teacher.id, live.id);
  assert(
    new Date(started2.actualStartTime).getTime() === new Date(started.actualStartTime).getTime(),
    '重复开始直播不改变 actualStartTime',
  );

  // ============ 4. 未报名学生签到被拒，且不产生记录 ============
  await expectFail(
    attendanceService.checkIn(studentC.id, live.id),
    403, '未报名', '未报名学生签到被拒',
  );
  const cCount = await attendanceRepo.count({ where: { studentId: studentC.id } });
  assert(cCount === 0, '被拒绝的签到不产生任何记录');

  // ============ 5. 五分钟内签到为出勤 ============
  const r1 = await attendanceService.checkIn(studentA.id, live.id);
  assert(r1.repeated === false && r1.record.status === AttendanceStatus.PRESENT, '5 分钟内签到为出勤');

  // 窗口回读：myRecord 一致
  win = await attendanceService.getCheckInWindow(studentA.id, UserRole.STUDENT, live.id);
  assert(win.myRecord?.id === r1.record.id && win.myRecord.status === 'present', '刷新后回读到同一条出勤记录');

  // ============ 6. 重复提交只返回原记录，记录不变 ============
  const beforeTime = r1.record.checkInTime.toISOString();
  await new Promise((r) => setTimeout(r, 20));
  const r1Repeat = await attendanceService.checkIn(studentA.id, live.id);
  assert(
    r1Repeat.repeated === true &&
      r1Repeat.record.id === r1.record.id &&
      r1Repeat.record.status === AttendanceStatus.PRESENT &&
      new Date(r1Repeat.record.checkInTime).toISOString() === beforeTime,
    '重复提交返回原记录且状态/时间不变',
  );
  const aCount = await attendanceRepo.count({ where: { studentId: studentA.id, liveClassId: live.id } });
  assert(aCount === 1, '数据库中只有一条签到记录');

  // ============ 7. 并发重复提交（5 个并发）只产生一条 ============
  const live2 = await liveRepo.save(
    liveRepo.create({
      title: '直播2', courseId: course.id, lessonId: lesson.id,
      teacherId: teacher.id, status: LiveClassStatus.LIVE, actualStartTime: new Date(),
    }),
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () => attendanceService.checkIn(studentA.id, live2.id)),
  );
  const distinctIds = new Set(results.map((r) => r.record.id));
  const repeatedCount = results.filter((r) => r.repeated).length;
  assert(distinctIds.size === 1 && repeatedCount === 4, '并发重复提交：仅一条新建，其余全部返回原记录');
  const aCount2 = await attendanceRepo.count({ where: { studentId: studentA.id, liveClassId: live2.id } });
  assert(aCount2 === 1, '并发后数据库仍只有一条记录');

  // ============ 8. 5~10 分钟签到为迟到 ============
  await ds.query(
    `UPDATE live_classes SET "actualStartTime" = $1 WHERE id = $2`,
    [new Date(Date.now() - 6 * 60 * 1000), live.id],
  );
  const r2 = await attendanceService.checkIn(studentB.id, live.id);
  assert(r2.record.status === AttendanceStatus.LATE && r2.repeated === false, '第 6 分钟签到为迟到');
  win = await attendanceService.getCheckInWindow(studentB.id, UserRole.STUDENT, live.id);
  assert(win.phase === 'late', '窗口阶段为 late');

  // ============ 9. 10 分钟后窗口关闭，签到被拒，原记录不变 ============
  await ds.query(
    `UPDATE live_classes SET "actualStartTime" = $1 WHERE id = $2`,
    [new Date(Date.now() - 11 * 60 * 1000), live.id],
  );
  await expectFail(
    attendanceService.checkIn(studentC.id, live.id),
    400, '签到窗口已关闭', '窗口关闭后签到被拒',
  );
  win = await attendanceService.getCheckInWindow(studentC.id, UserRole.STUDENT, live.id);
  assert(win.phase === 'closed' && win.canCheckIn === false, '窗口阶段为 closed');
  // 原记录状态不被窗口关闭影响
  const aRec = await attendanceRepo.findOne({ where: { studentId: studentA.id, liveClassId: live.id } });
  const bRec = await attendanceRepo.findOne({ where: { studentId: studentB.id, liveClassId: live.id } });
  assert(aRec.status === 'present' && bRec.status === 'late', '窗口关闭不改变已有出勤/迟到记录');

  // ============ 10. 结束直播：未签到已报名学生统一缺勤 + 汇总，一次落盘 ============
  const endRes = await liveService.endLive(teacher.id, live.id);
  assert(endRes.liveClass.status === LiveClassStatus.ENDED && !!endRes.liveClass.endTime, '直播状态置为 ended');
  assert(
    endRes.summary.total === 2 &&
      endRes.summary.present === 1 &&
      endRes.summary.late === 1 &&
      endRes.summary.absent === 0,
    `结束返回汇总正确（应到2/出勤1/迟到1/缺勤0），实际 ${JSON.stringify(endRes.summary)}`,
  );

  // ============ 11. 并发/重复结束只成功一次 ============
  await expectFail(
    liveService.endLive(teacher.id, live.id),
    409, '请勿重复', '重复结束被拒绝',
  );
  const live3 = await liveRepo.save(
    liveRepo.create({
      title: '直播3', courseId: course.id, lessonId: lesson.id,
      teacherId: teacher.id, status: LiveClassStatus.LIVE, actualStartTime: new Date(),
    }),
  );
  const endResults = await Promise.allSettled(
    Array.from({ length: 6 }, () => liveService.endLive(teacher.id, live3.id)),
  );
  const fulfilled = endResults.filter((r) => r.status === 'fulfilled');
  const rejected = endResults.filter((r) => r.status === 'rejected');
  assert(fulfilled.length === 1 && rejected.length === 5, `6 个并发结束：1 成功 5 拒绝（实际 ${fulfilled.length}/${rejected.length}）`);
  const live3Row = await liveRepo.findOne({ where: { id: live3.id } });
  assert(live3Row.status === LiveClassStatus.ENDED, '并发结束后直播状态为 ended');

  // ============ 12. 结束时未签到学生统一记缺勤，汇总与状态一致 ============
  // live3：甲在窗口内签到；乙、丙(未报名) 不操作 → 结束后乙缺勤，丙无记录
  const live4 = await liveRepo.save(
    liveRepo.create({
      title: '直播4', courseId: course.id, lessonId: lesson.id,
      teacherId: teacher.id, status: LiveClassStatus.LIVE, actualStartTime: new Date(),
    }),
  );
  await attendanceService.checkIn(studentA.id, live4.id); // present
  await liveService.endLive(teacher.id, live4.id);
  const bAbsent = await attendanceRepo.findOne({ where: { studentId: studentB.id, liveClassId: live4.id } });
  const cNone = await attendanceRepo.findOne({ where: { studentId: studentC.id, liveClassId: live4.id } });
  assert(bAbsent && bAbsent.status === 'absent' && bAbsent.checkInTime === null, '未签到的已报名学生记缺勤');
  assert(cNone === null, '未报名学生不会被记缺勤');
  const summary = await attendanceService.getSummary(live4.id);
  assert(
    summary.total === 2 && summary.present === 1 && summary.late === 0 && summary.absent === 1,
    `落盘汇总正确（应到2/出勤1/缺勤1），实际 ${JSON.stringify(summary)}`,
  );
  win = await attendanceService.getCheckInWindow(studentB.id, UserRole.STUDENT, live4.id);
  assert(
    win.phase === 'closed' && win.myRecord?.status === 'absent' &&
      win.summary?.absent === 1 && win.summary?.present === 1,
    '结束后窗口接口回读缺勤记录与汇总一致',
  );

  // ============ 13. 结束后再签到被拒，状态与记录不变 ============
  await expectFail(
    attendanceService.checkIn(studentB.id, live4.id),
    400, '已结束', '结束后签到被拒',
  );

  // ============ 14. 非教师不能开始/结束直播（权限） ============
  const live5 = await liveRepo.save(
    liveRepo.create({
      title: '直播5', courseId: course.id, lessonId: lesson.id,
      teacherId: teacher.id, status: LiveClassStatus.LIVE, actualStartTime: new Date(),
    }),
  );
  await expectFail(liveService.endLive(studentA.id, live5.id), 403, '无权', '学生不能结束直播');
  await expectFail(liveService.startLive(studentA.id, live5.id), 403, '无权', '学生不能操作直播');

  console.log(`\n==== 结果：${passed} 通过，${failed} 失败 ====`);
  await app.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
