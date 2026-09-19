# 签到闭环测试

两个无第三方测试框架依赖的脚本，直接启动 Nest 应用对真实 PostgreSQL 验证。

## 前置条件

- 一个可连通的 PostgreSQL（TypeORM `synchronize: true` 会自动建表）
- 已构建后端：`npm run build`

## 运行

```bash
# 默认连接 127.0.0.1:5544（可用 docker-compose 的 5501 覆盖）
POSTGRES_PORT=5501 POSTGRES_PASSWORD=postgres123 npm run test:integration
npm run test:smoke          # HTTP 冒烟，默认监听 3099，可用 TEST_PORT 覆盖
```

> 两个脚本都会 `TRUNCATE` 业务表，只能在开发/测试库运行。

## 覆盖场景

`integration-test.js`（Service 层，30 项断言）：

1. 未开窗签到拒绝；窗口接口 `not_open`
2. 教师签到拒绝
3. 重复开始直播不改变 `actualStartTime`（签到窗口锚点稳定）
4. 未报名签到拒绝且不落任何记录
5. 开始 5 分钟内签到为出勤，刷新窗口回读一致
6. 重复提交原样返回，记录状态/时间不变，库里仅一条
7. 5 个并发签到只产生一条记录
8. 5~10 分钟签到为迟到，窗口阶段 `late`
9. 10 分钟后窗口关闭拒绝，已有出勤/迟到记录不变
10. 结束直播：未签到的已报名学生统一缺勤，结束状态+汇总一次落盘
11. 重复结束 409；6 个并发结束仅 1 个成功
12. 未报名学生不会被补缺勤；结束后窗口接口回读记录+汇总一致
13. 结束后再签到拒绝且状态/记录不变
14. 非教师无权开始/结束直播

`http-smoke.js`（HTTP 层）：验证 201/400/401/403/404/409 状态码、
`{ message }` 错误结构（前端 `error.response.data.message` 依赖）、
签到/重复签到/结束/汇总的真实响应体。
