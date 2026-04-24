import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/present(.*)",
  "/api/analyze(.*)",
  "/api/uploadthing(.*)",
  "/api/billing(.*)",
  "/api/clients(.*)",
  "/api/variants(.*)",
]);

const DEV_NO_AUTH = process.env.LOCAL_DEV_NO_AUTH === "true";

const devPassthrough = (_req: NextRequest) => NextResponse.next();

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export default DEV_NO_AUTH ? devPassthrough : clerkHandler;

export const config = {
  matcher: [
    // Skip Next.js internals + static files
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
