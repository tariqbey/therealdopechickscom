import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * Issues a client-upload token for Vercel Blob, but ONLY after verifying the
 * caller is an authenticated creator. The browser uploads the (large) VR video
 * straight to Blob with this token via @vercel/blob/client `upload()`.
 *
 * clientPayload carries the user's Supabase access token, which we verify
 * server-side against Supabase auth before allowing the upload.
 */
export const config = { runtime: "nodejs" };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // clientPayload is the Supabase access token (string)
        const accessToken = clientPayload;
        if (!accessToken) throw new Error("Not authenticated");

        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!userRes.ok) throw new Error("Invalid session");
        const user = await userRes.json();
        if (!user?.id) throw new Error("Invalid session");

        // Confirm the user is a creator before letting them upload
        const profRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}&select=is_creator`,
          { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` } }
        );
        const profiles = await profRes.json();
        if (!Array.isArray(profiles) || !profiles[0]?.is_creator) {
          throw new Error("Creator access required");
        }

        return {
          allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"],
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024, // 2 GB
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // The browser writes the DB rows after upload(); nothing needed here.
        // (This webhook only fires on deployed URLs, not localhost.)
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }
}
