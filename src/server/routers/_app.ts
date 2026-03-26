import { router } from "../trpc";
import { collegeRouter } from "./college";
import { departmentRouter } from "./department";
import { driveRouter } from "./drive";
import { testRouter } from "./test";
import { questionRouter } from "./question";
import { studentRouter } from "./student";
import { attemptRouter } from "./attempt";
import { libraryRouter } from "./library";
import { reportRouter } from "./report";
import { statsRouter } from "./stats";
import { userRouter } from "./user";
import { notificationRouter } from "./notification";
import { authRouter } from "./auth";

export const appRouter = router({
  college: collegeRouter,
  department: departmentRouter,
  drive: driveRouter,
  test: testRouter,
  question: questionRouter,
  student: studentRouter,
  attempt: attemptRouter,
  library: libraryRouter,
  report: reportRouter,
  stats: statsRouter,
  user: userRouter,
  notification: notificationRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
