import { Building2, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailSettingsInviteCard({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    myInvite,
    inviteActionId,
    handleInviteResponse,
  } = vm;

  if (!myInvite) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          {myInvite.roles.includes("judge") ? (
            <Gavel className="size-5 text-primary" aria-hidden />
          ) : (
            <Building2 className="size-5 text-primary" aria-hidden />
          )}
          <div>
            <h2 className="text-lg font-medium tracking-tight text-foreground">
              {translate("workspace.manage.inviteCollaborationTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate("workspace.manage.inviteMetaLine", {
                roles: myInvite.roles.join(", "),
                status: myInvite.status,
              })}
            </p>
          </div>
        </div>
        {myInvite.note && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {myInvite.note}
          </p>
        )}
        {myInvite.status === "pending" && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={inviteActionId === myInvite.id}
              onClick={() => void handleInviteResponse("accepted")}
            >
              {translate("workspace.manage.inviteAccept")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={inviteActionId === myInvite.id}
              onClick={() => void handleInviteResponse("declined")}
            >
              {translate("workspace.manage.inviteDecline")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
