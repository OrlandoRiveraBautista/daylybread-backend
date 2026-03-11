import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import crypto from "crypto";
import { TeamInvite, TeamInviteInput, InviteStatus, InviteMethod } from "../../../entities/Worship/TeamInvite";
import { TeamMember } from "../../../entities/Worship/TeamMember";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";
import { EmailService } from "../../../services/EmailService";
import {
  Notification,
  NotificationContentType,
  NotificationDeliveryType,
  NotificationStatus,
} from "../../../entities/Notification";

@ObjectType()
class TeamInviteResponse {
  @Field(() => TeamInvite, { nullable: true })
  results?: TeamInvite;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class TeamInvitesResponse {
  @Field(() => [TeamInvite], { nullable: true })
  results?: TeamInvite[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class TeamInviteResolver {
  @ValidateUser()
  @Query(() => TeamInvitesResponse)
  async getTeamInvites(
    @Arg("teamId") teamId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInvitesResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    // Verify user is the team author or a member
    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(teamId) }, { populate: ["author"] });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    const isAuthor = team.author._id.equals(req.userId);
    const isMember = await em.findOne(TeamMember, {
      team: new ObjectId(teamId),
      user: req.userId,
    });

    if (!isAuthor && !isMember) {
      return {
        errors: [{ field: "WorshipTeam", message: "You do not have access to this team" }],
      };
    }

    const invites = await em.find(
      TeamInvite,
      { team: new ObjectId(teamId) },
      { populate: ["team", "invitedBy", "invitedUser"], orderBy: { createdAt: "DESC" } }
    );

    return { results: invites };
  }

  @ValidateUser()
  @Query(() => TeamInvitesResponse)
  async getMyInvites(
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInvitesResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const invites = await em.find(
      TeamInvite,
      {
        $or: [
          { invitedUser: req.userId },
          { email: (await em.findOne(User, { _id: req.userId }))?.email },
        ],
        status: InviteStatus.PENDING,
      },
      { populate: ["team", "invitedBy", "invitedUser"], orderBy: { createdAt: "DESC" } }
    );

    return { results: invites };
  }

  @ValidateUser()
  @Query(() => TeamInviteResponse)
  async getInviteByToken(
    @Arg("token") token: string,
    @Ctx() { em }: MyContext
  ): Promise<TeamInviteResponse> {
    const invite = await em.findOne(
      TeamInvite,
      { inviteToken: token },
      { populate: ["team", "invitedBy", "invitedUser"] }
    );

    if (!invite) {
      return {
        errors: [{ field: "TeamInvite", message: "Invalid invite link" }],
      };
    }

    if (invite.status !== InviteStatus.PENDING) {
      return {
        errors: [{ field: "TeamInvite", message: "This invite has already been responded to" }],
      };
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      invite.status = InviteStatus.EXPIRED;
      await em.persistAndFlush(invite);
      return {
        errors: [{ field: "TeamInvite", message: "This invite has expired" }],
      };
    }

    return { results: invite };
  }

  @ValidateUser()
  @Mutation(() => TeamInviteResponse)
  async sendTeamInvite(
    @Arg("options", () => TeamInviteInput) options: TeamInviteInput,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInviteResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const invitedByUser = await em.findOne(User, { _id: req.userId });
    if (!invitedByUser) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(options.teamId) }, { populate: ["author"] });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    // Only team author can send invites
    if (!team.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can send invites" }],
      };
    }

    // Resolve the invited user
    let invitedUser: User | null = null;
    let inviteEmail: string | undefined = options.email;

    if (options.userId) {
      invitedUser = await em.findOne(User, { _id: new ObjectId(options.userId) });
      if (!invitedUser) {
        return {
          errors: [{ field: "User", message: "Invited user not found" }],
        };
      }
      inviteEmail = invitedUser.email;
    } else if (options.email) {
      // Check if a user with this email already exists
      invitedUser = await em.findOne(User, { email: options.email });
    }

    // Check for existing pending invite
    const existingInvite = await em.findOne(TeamInvite, {
      team: new ObjectId(options.teamId),
      status: InviteStatus.PENDING,
      ...(invitedUser
        ? { invitedUser: invitedUser._id }
        : { email: inviteEmail }),
    });

    if (existingInvite) {
      return {
        errors: [{ field: "TeamInvite", message: "An invite is already pending for this person" }],
      };
    }

    // Check if already a member
    if (invitedUser) {
      const existingMember = await em.findOne(TeamMember, {
        team: new ObjectId(options.teamId),
        user: invitedUser._id,
      });

      if (existingMember) {
        return {
          errors: [{ field: "TeamMember", message: "This person is already a member of this team" }],
        };
      }
    }

    const invite = em.create(TeamInvite, {
      team,
      invitedBy: invitedByUser,
      invitedUser: invitedUser || undefined,
      email: inviteEmail,
      role: options.role,
      method: options.method,
      skills: options.skills,
    });

    try {
      await em.persistAndFlush(invite);
      await em.populate(invite, ["team", "invitedBy", "invitedUser"]);

      // Send email invite
      if (options.method === InviteMethod.EMAIL || options.method === InviteMethod.BOTH) {
        if (inviteEmail) {
          await this.sendInviteEmail(invite, inviteEmail, invitedByUser, team);
        }
      }

      // Send in-app notification invite
      if (options.method === InviteMethod.NOTIFICATION || options.method === InviteMethod.BOTH) {
        if (invitedUser) {
          await this.sendInviteNotification(em, invite, invitedUser, invitedByUser, team);
        }
      }
    } catch (err) {
      console.error("Error sending team invite:", err);
      return {
        errors: [{ field: "TeamInvite", message: "Failed to send team invite" }],
      };
    }

    return { results: invite };
  }

  @ValidateUser()
  @Mutation(() => TeamInviteResponse)
  async respondToInvite(
    @Arg("inviteId") inviteId: string,
    @Arg("accept") accept: boolean,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInviteResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const invite = await em.findOne(
      TeamInvite,
      { _id: new ObjectId(inviteId) },
      { populate: ["team", "invitedBy"] }
    );

    if (!invite) {
      return {
        errors: [{ field: "TeamInvite", message: "Invite not found" }],
      };
    }

    if (invite.status !== InviteStatus.PENDING) {
      return {
        errors: [{ field: "TeamInvite", message: "This invite has already been responded to" }],
      };
    }

    // Check if invite has expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      invite.status = InviteStatus.EXPIRED;
      await em.persistAndFlush(invite);
      return {
        errors: [{ field: "TeamInvite", message: "This invite has expired" }],
      };
    }

    const user = await em.findOne(User, { _id: req.userId });
    if (!user) {
      return {
        errors: [{ field: "User", message: "User not found" }],
      };
    }

    if (accept) {
      invite.status = InviteStatus.ACCEPTED;

      // Create the TeamMember record
      const member = em.create(TeamMember, {
        team: invite.team,
        user,
        role: invite.role,
        skills: invite.skills,
      });

      await em.persistAndFlush([invite, member]);
    } else {
      invite.status = InviteStatus.DECLINED;
      await em.persistAndFlush(invite);
    }

    await em.populate(invite, ["team", "invitedBy", "invitedUser"]);

    // Dismiss the matching in-app notification
    try {
      const inviteNotification = await em.findOne(Notification, {
        userId: user._id.toString(),
        contentType: NotificationContentType.TEAM_INVITE,
        status: { $in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
        metadata: { inviteId: invite._id.toString() },
      } as any);
      if (inviteNotification) {
        inviteNotification.status = NotificationStatus.READ;
        inviteNotification.readAt = new Date();
        await em.persistAndFlush(inviteNotification);
      }
    } catch (_) {}

    return { results: invite };
  }

  @ValidateUser()
  @Mutation(() => TeamInviteResponse)
  async acceptInviteByToken(
    @Arg("token") token: string,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInviteResponse> {
    const req = request as any;

    const invite = await em.findOne(
      TeamInvite,
      { inviteToken: token },
      { populate: ["team", "invitedBy"] }
    );

    if (!invite) {
      return {
        errors: [{ field: "TeamInvite", message: "Invalid invite link" }],
      };
    }

    if (invite.status !== InviteStatus.PENDING) {
      return {
        errors: [{ field: "TeamInvite", message: "This invite has already been responded to" }],
      };
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      invite.status = InviteStatus.EXPIRED;
      await em.persistAndFlush(invite);
      return {
        errors: [{ field: "TeamInvite", message: "This invite has expired" }],
      };
    }

    // User must be logged in to accept
    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "Please sign up or log in to accept this invite" }],
      };
    }

    const user = await em.findOne(User, { _id: req.userId });
    if (!user) {
      return {
        errors: [{ field: "User", message: "User not found" }],
      };
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.invitedUser = user;

    const member = em.create(TeamMember, {
      team: invite.team,
      user,
      role: invite.role,
      skills: invite.skills,
    });

    try {
      await em.persistAndFlush([invite, member]);
      await em.populate(invite, ["team", "invitedBy", "invitedUser"]);
    } catch (err: any) {
      // Write conflict (code 112) means a concurrent request already accepted this invite
      if (err?.code === 112 || err?.cause?.code === 112) {
        em.clear();
        const accepted = await em.findOne(
          TeamInvite,
          { inviteToken: token },
          { populate: ["team", "invitedBy", "invitedUser"] }
        );
        if (accepted?.status === InviteStatus.ACCEPTED) {
          return { results: accepted };
        }
      }
      console.error("Error accepting invite:", err);
      return {
        errors: [{ field: "TeamInvite", message: "Failed to accept invite" }],
      };
    }

    // Dismiss the matching in-app notification so it no longer appears in the notification center
    try {
      const inviteNotification = await em.findOne(Notification, {
        userId: user._id.toString(),
        contentType: NotificationContentType.TEAM_INVITE,
        status: { $in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
        metadata: { inviteId: invite._id.toString() },
      } as any);
      if (inviteNotification) {
        inviteNotification.status = NotificationStatus.READ;
        inviteNotification.readAt = new Date();
        await em.persistAndFlush(inviteNotification);
      }
    } catch (_) {
      // Non-critical — don't fail the whole operation if notification dismissal errors
    }

    return { results: invite };
  }

  @ValidateUser()
  @Mutation(() => TeamInviteResponse)
  async resendTeamInvite(
    @Arg("inviteId") inviteId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInviteResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const invite = await em.findOne(
      TeamInvite,
      { _id: new ObjectId(inviteId) },
      { populate: ["team", "invitedBy", "invitedUser"] }
    );

    if (!invite) {
      return {
        errors: [{ field: "TeamInvite", message: "Invite not found" }],
      };
    }

    if (invite.status === InviteStatus.ACCEPTED) {
      return {
        errors: [{ field: "TeamInvite", message: "This invite has already been accepted" }],
      };
    }

    // Only team author can resend invites
    const teamForResend = await em.findOne(WorshipTeam, { _id: invite.team._id }, { populate: ["author"] });
    if (!teamForResend || !teamForResend.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can resend invites" }],
      };
    }

    const invitedByUser = await em.findOne(User, { _id: req.userId });
    if (!invitedByUser) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    invite.status = InviteStatus.PENDING;
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invite.inviteToken = crypto.randomBytes(32).toString("hex");

    try {
      await em.persistAndFlush(invite);

      const email = invite.email || invite.invitedUser?.email;

      if (invite.method === InviteMethod.EMAIL || invite.method === InviteMethod.BOTH) {
        if (email) {
          await this.sendInviteEmail(invite, email, invitedByUser, invite.team);
        }
      }

      if (invite.method === InviteMethod.NOTIFICATION || invite.method === InviteMethod.BOTH) {
        if (invite.invitedUser) {
          await this.sendInviteNotification(em, invite, invite.invitedUser, invitedByUser, invite.team);
        }
      }
    } catch (err) {
      console.error("Error resending team invite:", err);
      return {
        errors: [{ field: "TeamInvite", message: "Failed to resend team invite" }],
      };
    }

    return { results: invite };
  }

  @ValidateUser()
  @Mutation(() => TeamInviteResponse)
  async cancelTeamInvite(
    @Arg("inviteId") inviteId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamInviteResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const invite = await em.findOne(TeamInvite, { _id: new ObjectId(inviteId) }, { populate: ["team"] });

    if (!invite) {
      return {
        errors: [{ field: "TeamInvite", message: "Invite not found" }],
      };
    }

    // Only team author can cancel invites
    const teamForCancel = await em.findOne(WorshipTeam, { _id: invite.team._id }, { populate: ["author"] });
    if (!teamForCancel || !teamForCancel.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can cancel invites" }],
      };
    }

    try {
      await em.removeAndFlush(invite);
    } catch (err) {
      console.error("Error cancelling invite:", err);
      return {
        errors: [{ field: "TeamInvite", message: "Failed to cancel invite" }],
      };
    }

    return { results: invite };
  }

  private async sendInviteEmail(
    invite: TeamInvite,
    email: string,
    invitedBy: User,
    team: WorshipTeam
  ): Promise<void> {
    try {
      const emailService = new EmailService();
      const baseUrl = (process.env.PLATFORM_FRONTEND_URL || "https://platform.daylybread.com").replace(/\/$/, "");
      const inviteLink = `${baseUrl}/worship/invite/${invite.inviteToken}`;

      const notification = new Notification();
      notification.userId = "system";
      notification.contentType = NotificationContentType.TEAM_INVITE;
      notification.deliveryType = NotificationDeliveryType.EMAIL;
      notification.title = `You're invited to join ${team.name}`;
      notification.message = `${invitedBy.firstName || "Someone"} has invited you to join the worship team "${team.name}" on DaylyBread.`;
      notification.actionUrl = inviteLink;
      notification.actionText = "Accept Invite";
      notification.status = NotificationStatus.SENT;

      await emailService.sendNotificationEmail(email, notification);
    } catch (err) {
      console.error("Error sending invite email:", err);
    }
  }

  private async sendInviteNotification(
    em: any,
    invite: TeamInvite,
    invitedUser: User,
    invitedBy: User,
    team: WorshipTeam
  ): Promise<void> {
    try {
      const notification = em.create(Notification, {
        userId: invitedUser._id.toString(),
        contentType: NotificationContentType.TEAM_INVITE,
        deliveryType: NotificationDeliveryType.IN_APP,
        title: `Worship Team Invite`,
        message: `${invitedBy.firstName || "Someone"} invited you to join "${team.name}"`,
        actionUrl: `/worship/invites`,
        actionText: "View Invite",
        metadata: {
          inviteId: invite._id.toString(),
          teamId: team._id.toString(),
          type: "team_invite",
        },
      });

      await em.persistAndFlush(notification);
    } catch (err) {
      console.error("Error sending invite notification:", err);
    }
  }
}
