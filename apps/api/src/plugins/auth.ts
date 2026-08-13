import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@connect-hospital/shared";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../env.js";

export interface AuthUser {
  id: string;
  role: Role;
  hospitalId: string | null;
  name: string;
  email: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
  interface FastifyInstance {
    /** preHandler: 401s unless a valid identity was resolved. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler factory: 403s unless the authenticated user has one of the given roles. */
    requireRole: (...roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Throws unless a HOSPITAL_ADMIN/DOCTOR's own hospitalId matches the given id
     *  (SUPER_ADMIN/SUPPORT/VERIFICATION are considered platform-scoped and always pass). */
    assertHospitalScope: (request: FastifyRequest, hospitalId: string) => void;
  }
}

export const firebaseConfigured = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
);

if (firebaseConfigured && getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // .env stores literal "\n" — restore real newlines for the PEM key.
      privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export interface DecodedFirebaseToken {
  uid: string;
  phone?: string;
  email?: string;
}

/** Verifies a bearer token independent of whether a User row exists yet —
 *  used by the patient self-registration bootstrap route. */
export async function verifyFirebaseBearerToken(authHeader: string | undefined): Promise<DecodedFirebaseToken | null> {
  if (!authHeader?.startsWith("Bearer ") || !firebaseConfigured) return null;
  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, phone: decoded.phone_number, email: decoded.email };
  } catch {
    return null;
  }
}

async function resolveAuthUser(app: FastifyInstance, request: FastifyRequest): Promise<AuthUser | null> {
  // Dev-only shortcut so the whole app is exercisable with zero Firebase setup:
  // pass `x-dev-user: <User.id>` to authenticate as that seeded user.
  if (env.DEV_AUTH_BYPASS) {
    const devUserId = request.headers["x-dev-user"];
    if (typeof devUserId === "string" && devUserId.length > 0) {
      const user = await app.prisma.user.findUnique({ where: { id: devUserId } });
      if (user) {
        return {
          id: user.id,
          role: user.role,
          hospitalId: user.hospitalId,
          name: user.name,
          email: user.email,
        };
      }
    }
  }

  const decoded = await verifyFirebaseBearerToken(request.headers.authorization);
  if (!decoded) return null;

  const user = await app.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (!user || user.status !== "ACTIVE") return null;
  return {
    id: user.id,
    role: user.role,
    hospitalId: user.hospitalId,
    name: user.name,
    email: user.email,
  };
}

export default fp(async (app: FastifyInstance) => {
  app.decorateRequest("authUser", null);

  app.addHook("preHandler", async (request) => {
    request.authUser = await resolveAuthUser(app, request);
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser) {
      reply.code(401).send({ error: "Authentication required" });
    }
  });

  app.decorate("requireRole", (...roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.authUser) {
        reply.code(401).send({ error: "Authentication required" });
        return;
      }
      if (!roles.includes(request.authUser.role)) {
        reply.code(403).send({ error: "Forbidden for this role" });
      }
    };
  });

  app.decorate("assertHospitalScope", (request: FastifyRequest, hospitalId: string) => {
    const user = request.authUser;
    if (!user) {
      const err = new Error("Unauthorized") as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }
    const platformScoped: Role[] = ["SUPER_ADMIN", "SUPPORT", "VERIFICATION"];
    if (platformScoped.includes(user.role)) return;
    if (user.hospitalId !== hospitalId) {
      const err = new Error("Forbidden: hospital scope mismatch") as Error & { statusCode?: number };
      err.statusCode = 403;
      throw err;
    }
  });
});
