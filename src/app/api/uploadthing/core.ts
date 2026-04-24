import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { requireUser } from "@/lib/auth/session";

const f = createUploadthing();

export const ourFileRouter = {
  clientPhoto: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      try {
        const user = await requireUser();
        return { userId: user.id };
      } catch {
        throw new UploadThingError("UNAUTHORIZED");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
