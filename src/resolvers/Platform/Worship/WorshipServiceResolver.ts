import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import {
  WorshipService,
  WorshipServiceInput,
  ServiceStatus,
} from "../../../entities/Worship/WorshipService";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { TeamMember } from "../../../entities/Worship/TeamMember";
import { ServiceAssignment } from "../../../entities/Worship/ServiceAssignment";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";
import {
  Notification,
  NotificationContentType,
  NotificationDeliveryType,
  NotificationStatus,
} from "../../../entities/Notification";
import { EmailService } from "../../../services/EmailService";

/**
 * Parse service date string in a timezone-resilient way.
 * - ISO datetime (with T): parsed as-is (UTC or with offset) → stored as UTC.
 * - Date-only (YYYY-MM-DD): normalized to noon UTC to avoid day rollback in western timezones.
 */
function parseServiceDateTime(dateStr: string): Date {
  const trimmed = dateStr.trim();
  if (trimmed.includes("T")) {
    return new Date(trimmed);
  }
  return new Date(trimmed + "T12:00:00.000Z");
}

@ObjectType()
class WorshipServiceResponse {
  @Field(() => WorshipService, { nullable: true })
  results?: WorshipService;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class WorshipServicesResponse {
  @Field(() => [WorshipService], { nullable: true })
  results?: WorshipService[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class WorshipServiceResolver {
  @ValidateUser()
  @Query(() => WorshipServicesResponse)
  async getWorshipServices(
    @Arg("teamId", { nullable: true }) teamId: string,
    @Ctx() { em, request }: MyContext,
  ): Promise<WorshipServicesResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    if (teamId) {
      const team = await em.findOne(
        WorshipTeam,
        { _id: new ObjectId(teamId) },
        { populate: ["author"] },
      );
      if (!team) {
        return {
          errors: [{ field: "WorshipTeam", message: "Team not found" }],
        };
      }

      const isTeamOwner = team.author._id.equals(req.userId);
      const membership = await em.findOne(TeamMember, {
        team: new ObjectId(teamId),
        user: req.userId,
      });
      if (!isTeamOwner && !membership) {
        return {
          errors: [
            {
              field: "WorshipTeam",
              message: "You do not have access to this team",
            },
          ],
        };
      }

      if (isTeamOwner) {
        // Owners see all services regardless of status
        const services = await em.find(
          WorshipService,
          { team: new ObjectId(teamId) },
          {
            orderBy: { date: "DESC" },
            populate: [
              "team",
              "author",
              "assignments",
              "assignments.member",
              "assignments.member.user",
              "setlist",
            ],
          },
        );
        return { results: services };
      }

      // Non-owners: only published (non-draft) services they are assigned to
      const myAssignments = await em.find(
        ServiceAssignment,
        { member: membership! },
        { populate: ["service"] },
      );
      const assignedServiceIds = myAssignments.map((a) => a.service._id);

      const services = await em.find(
        WorshipService,
        {
          _id: { $in: assignedServiceIds },
          status: { $ne: ServiceStatus.DRAFT },
        },
        {
          orderBy: { date: "DESC" },
          populate: [
            "team",
            "author",
            "assignments",
            "assignments.member",
            "assignments.member.user",
            "setlist",
          ],
        },
      );
      return { results: services };
    }

    // No teamId filter — return services across all teams the user is part of
    const memberships = await em.find(
      TeamMember,
      { user: req.userId },
      { populate: ["team", "team.author"] },
    );

    // Collect team IDs where the user is the owner
    const ownedTeamIds = memberships
      .filter((m) => m.team.author._id.equals(req.userId))
      .map((m) => m.team._id);

    // For non-owned teams, find only the services the user is assigned to
    const nonOwnerMemberships = memberships.filter(
      (m) => !m.team.author._id.equals(req.userId),
    );
    const assignedServiceIds: ObjectId[] = [];
    if (nonOwnerMemberships.length > 0) {
      const myAssignments = await em.find(
        ServiceAssignment,
        { member: { $in: nonOwnerMemberships.map((m) => m._id) } },
        { populate: ["service"] },
      );
      assignedServiceIds.push(...myAssignments.map((a) => a.service._id));
    }

    const services = await em.find(
      WorshipService,
      {
        $or: [
          // Services on teams the user owns — all statuses visible
          { author: req.userId },
          { team: { $in: ownedTeamIds } },
          // Services the user is assigned to on other teams — published only
          {
            _id: { $in: assignedServiceIds },
            status: { $ne: ServiceStatus.DRAFT },
          },
        ],
      },
      {
        orderBy: { date: "DESC" },
        populate: [
          "team",
          "author",
          "assignments",
          "assignments.member",
          "assignments.member.user",
          "setlist",
        ],
      },
    );

    return { results: services };
  }

  @ValidateUser()
  @Query(() => WorshipServiceResponse)
  async getWorshipService(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext,
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const service = await em.findOne(
      WorshipService,
      { _id: new ObjectId(id) },
      {
        populate: [
          "team",
          "author",
          "assignments",
          "assignments.member",
          "assignments.member.user",
          "setlist",
          "setlist.items",
          "setlist.items.song",
        ],
      },
    );

    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    const isServiceAuthor = service.author._id.equals(req.userId);

    // Check team ownership
    const serviceTeam = await em.findOne(
      WorshipTeam,
      { _id: service.team._id },
      { populate: ["author"] },
    );
    const isTeamOwner = serviceTeam?.author._id.equals(req.userId) ?? false;

    if (isServiceAuthor || isTeamOwner) {
      // Owners see the service regardless of status
      return { results: service };
    }

    // For non-owners: must be a team member AND assigned AND service must be published
    const membership = await em.findOne(TeamMember, {
      team: service.team._id,
      user: req.userId,
    });
    if (!membership) {
      return {
        errors: [
          {
            field: "WorshipService",
            message: "You do not have access to this service",
          },
        ],
      };
    }

    if (service.status === ServiceStatus.DRAFT) {
      return {
        errors: [
          {
            field: "WorshipService",
            message: "This service has not been published yet",
          },
        ],
      };
    }

    const assignment = await em.findOne(ServiceAssignment, {
      service: service._id,
      member: membership._id,
    });
    if (!assignment) {
      return {
        errors: [
          {
            field: "WorshipService",
            message: "You have not been assigned to this service",
          },
        ],
      };
    }

    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async createWorshipService(
    @Arg("options", () => WorshipServiceInput) options: WorshipServiceInput,
    @Ctx() { em, request }: MyContext,
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const user = await em.findOne(User, { _id: req.userId });
    if (!user) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    const team = await em.findOne(
      WorshipTeam,
      { _id: new ObjectId(options.teamId) },
      { populate: ["author"] },
    );
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    // Verify user is team author or member
    const isTeamAuthor = team.author._id.equals(req.userId);
    const isTeamMember = await em.findOne(TeamMember, {
      team: new ObjectId(options.teamId),
      user: req.userId,
    });
    if (!isTeamAuthor && !isTeamMember) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "You do not have access to this team",
          },
        ],
      };
    }

    const service = em.create(WorshipService, {
      name: options.name,
      date: parseServiceDateTime(options.date),
      team,
      author: user,
      notes: options.notes,
      status: options.status,
    });

    try {
      await em.persistAndFlush(service);
      await em.populate(service, ["team", "author"]);
    } catch (err) {
      console.error("Error creating worship service:", err);
      return {
        errors: [
          {
            field: "WorshipService",
            message: "Failed to create worship service",
          },
        ],
      };
    }

    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async updateWorshipService(
    @Arg("id") id: string,
    @Arg("options", () => WorshipServiceInput) options: WorshipServiceInput,
    @Ctx() { em, request }: MyContext,
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const service = await em.findOne(
      WorshipService,
      { _id: new ObjectId(id) },
      { populate: ["author", "team"] },
    );
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    // Only the service author or team owner can update
    const serviceTeam = await em.findOne(
      WorshipTeam,
      { _id: service.team._id },
      { populate: ["author"] },
    );
    const isServiceAuthor = service.author._id.equals(req.userId);
    const isTeamOwner = serviceTeam?.author._id.equals(req.userId);
    if (!isServiceAuthor && !isTeamOwner) {
      return {
        errors: [
          {
            field: "WorshipService",
            message:
              "Only the service creator or team owner can update this service",
          },
        ],
      };
    }

    const team = await em.findOne(WorshipTeam, {
      _id: new ObjectId(options.teamId),
    });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    try {
      em.assign(service, {
        name: options.name,
        date: parseServiceDateTime(options.date),
        team,
        notes: options.notes,
        status: options.status || service.status,
      });
      await em.persistAndFlush(service);
      await em.populate(service, [
        "team",
        "author",
        "assignments",
        "assignments.member",
        "assignments.member.user",
      ]);
    } catch (err) {
      console.error("Error updating worship service:", err);
      return {
        errors: [
          {
            field: "WorshipService",
            message: "Failed to update worship service",
          },
        ],
      };
    }

    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async publishWorshipService(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext,
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const service = await em.findOne(
      WorshipService,
      { _id: new ObjectId(id) },
      {
        populate: [
          "author",
          "team",
          "assignments",
          "assignments.member",
          "assignments.member.user",
        ],
      },
    );

    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    const serviceTeam = await em.findOne(
      WorshipTeam,
      { _id: service.team._id },
      { populate: ["author"] },
    );
    const isServiceAuthor = service.author._id.equals(req.userId);
    const isTeamOwner = serviceTeam?.author._id.equals(req.userId);
    if (!isServiceAuthor && !isTeamOwner) {
      return {
        errors: [
          {
            field: "WorshipService",
            message:
              "Only the service creator or team owner can publish this service",
          },
        ],
      };
    }

    if (service.status === ServiceStatus.SCHEDULED) {
      return {
        errors: [
          { field: "WorshipService", message: "Service is already published" },
        ],
      };
    }

    // Mark as scheduled (published)
    service.status = ServiceStatus.SCHEDULED;
    await em.persistAndFlush(service);

    // Notify all assignees
    const publisher = await em.findOne(User, { _id: req.userId });
    const publisherName = publisher
      ? `${publisher.firstName || ""} ${publisher.lastName || ""}`.trim() ||
        "Your worship leader"
      : "Your worship leader";

    const serviceDate = new Date(service.date).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const baseUrl = (
      process.env.PLATFORM_FRONTEND_URL || "https://platform.daylybread.com"
    ).replace(/\/$/, "");
    const actionUrl = `/worship/services/${service._id.toString()}`;
    const emailService = new EmailService();

    const assignments = service.assignments.getItems();

    for (const assignment of assignments) {
      const member = assignment.member;
      if (!member) continue;
      const user: User = member.user;
      if (!user || user._id.equals(req.userId)) continue;

      const message = `${publisherName} has published "${service.name}" on ${serviceDate}. You've been assigned as ${assignment.role.replace(/_/g, " ")}.`;

      // In-app notification
      try {
        const inAppNotification = new Notification();
        inAppNotification.userId = user._id.toString();
        inAppNotification.contentType =
          NotificationContentType.SERVICE_PUBLISHED;
        inAppNotification.deliveryType = NotificationDeliveryType.IN_APP;
        inAppNotification.title = `Service Scheduled: ${service.name}`;
        inAppNotification.message = message;
        inAppNotification.actionUrl = actionUrl;
        inAppNotification.actionText = "View Service";
        inAppNotification.metadata = {
          serviceId: service._id.toString(),
          serviceName: service.name,
          serviceDate,
          teamName: service.team?.name || "",
          type: "service_published",
        };
        await em.persistAndFlush(inAppNotification);
      } catch (err) {
        console.error(
          `Error creating in-app notification for user ${user._id}:`,
          err,
        );
      }

      // Email notification
      if (user.email) {
        try {
          const emailNotification = new Notification();
          emailNotification.userId = user._id.toString();
          emailNotification.contentType =
            NotificationContentType.SERVICE_PUBLISHED;
          emailNotification.deliveryType = NotificationDeliveryType.EMAIL;
          emailNotification.title = `Service Scheduled: ${service.name}`;
          emailNotification.message = message;
          emailNotification.actionUrl = `${baseUrl}${actionUrl}`;
          emailNotification.actionText = "View Service";
          emailNotification.status = NotificationStatus.SENT;
          emailNotification.metadata = {
            serviceName: service.name,
            serviceDate,
            teamName: service.team?.name || "",
          };

          await emailService.sendNotificationEmail(
            user.email,
            emailNotification,
          );
        } catch (err) {
          console.error(
            `Error sending email notification to ${user.email}:`,
            err,
          );
        }
      }
    }

    await em.populate(service, [
      "team",
      "author",
      "assignments",
      "assignments.member",
      "assignments.member.user",
    ]);
    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async deleteWorshipService(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext,
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const service = await em.findOne(
      WorshipService,
      { _id: new ObjectId(id) },
      { populate: ["author", "team"] },
    );
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    // Only the service author or team owner can delete
    const delTeam = await em.findOne(
      WorshipTeam,
      { _id: service.team._id },
      { populate: ["author"] },
    );
    const isDelAuthor = service.author._id.equals(req.userId);
    const isDelTeamOwner = delTeam?.author._id.equals(req.userId);
    if (!isDelAuthor && !isDelTeamOwner) {
      return {
        errors: [
          {
            field: "WorshipService",
            message:
              "Only the service creator or team owner can delete this service",
          },
        ],
      };
    }

    try {
      await em.removeAndFlush(service);
    } catch (err) {
      console.error("Error deleting worship service:", err);
      return {
        errors: [
          {
            field: "WorshipService",
            message: "Failed to delete worship service",
          },
        ],
      };
    }

    return { results: service };
  }
}
