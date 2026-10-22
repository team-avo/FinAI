"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

function roleLabel(r?: string) {
  if (r === "viewer") return "Viewer · read-only";
  if (r === "accountant") return "Accountant";
  if (r === "owner") return "Owner";
  return r ?? "";
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const info = trpc.members.inviteInfo.useQuery({ token });

  const accept = trpc.members.acceptInvite.useMutation({
    onSuccess: () => {
      toast.success("You've joined the team");
      router.push("/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  const data = info.data;
  const usable = data && !data.expired && data.status === "pending";
  const emailMatch = !!(session && data && session.user.email?.toLowerCase() === data.email.toLowerCase());

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {data?.orgName ?? "FinAI"}</CardTitle>
          <CardDescription>
            {info.isLoading
              ? "Loading your invitation…"
              : !data
                ? "This invitation link isn't valid."
                : data.expired
                  ? "This invitation has expired. Ask the owner to send a new one."
                  : data.status !== "pending"
                    ? "This invitation has already been used."
                    : (
                      <>
                        You&apos;ve been invited to join <b className="text-fg">{data.orgName}</b> as{" "}
                        <b className="text-fg">{roleLabel(data.role)}</b>.
                      </>
                    )}
          </CardDescription>
        </CardHeader>
        {usable && (
          <CardContent className="space-y-3">
            {sessionLoading ? (
              <p className="text-sm text-fg-muted">Checking your session…</p>
            ) : !session ? (
              <>
                <p className="text-sm text-fg-muted">
                  Sign in or create your account with <b className="text-fg">{data.email}</b> to join.
                </p>
                <Button asChild className="w-full">
                  <Link href={`/login?callbackUrl=/invite/${token}`}>Continue</Link>
                </Button>
              </>
            ) : emailMatch ? (
              <Button
                className="w-full"
                onClick={() => accept.mutate({ token })}
                disabled={accept.isPending}
              >
                {accept.isPending ? "Joining…" : `Accept & join ${data.orgName}`}
              </Button>
            ) : (
              <p className="text-sm text-fg-muted">
                This invite is for <b className="text-fg">{data.email}</b>, but you&apos;re signed in as{" "}
                {session.user.email}. Sign out and sign back in with {data.email} to accept.
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
