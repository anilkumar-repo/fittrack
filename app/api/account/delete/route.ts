import { roziServiceClient } from "@/lib/rozi-ai/service-client";

export const dynamic = "force-dynamic";

/** Storage buckets that keep a person's files in a folder named after their account ("<user id>/<file>"). */
const USER_FOLDERS = ["avatars", "post-photos"];

/**
 * Deletes the signed-in person's account (2026-11-26). Only the caller's own account: the user id comes from their
 * sign-in token, never from the request body. The body must say {"confirm": "DELETE"} so nothing deletes by accident.
 * Their pictures are removed first (storage files don't go with the account), then the account itself; every table
 * with their data deletes with it (foreign keys to auth.users are ON DELETE CASCADE; audit/report links are set to null).
 */
export async function POST(request: Request) {
  const db = roziServiceClient();
  if (!db) return Response.json({ error: "Deleting accounts isn't set up on this server." }, { status: 503 });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { confirm?: unknown };
  if (body.confirm !== "DELETE") return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });

  const userId = auth.user.id;
  for (const bucket of USER_FOLDERS) {
    const { data: files, error } = await db.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) return Response.json({ error: "Your pictures couldn't be removed. Nothing was deleted. Try again." }, { status: 500 });
    if (files?.length) {
      const { error: removeError } = await db.storage.from(bucket).remove(files.map((file) => `${userId}/${file.name}`));
      if (removeError) return Response.json({ error: "Your pictures couldn't be removed. Try again." }, { status: 500 });
    }
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: "Your account couldn't be deleted. Try again." }, { status: 500 });
  return Response.json({ deleted: true });
}
