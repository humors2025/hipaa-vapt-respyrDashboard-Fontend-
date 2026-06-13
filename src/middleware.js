// middleware.js
import { NextResponse } from 'next/server';

// Edge-side cookie reader. Cookies are URL-encoded JSON; decode then parse,
// returning null on any failure so middleware never throws.
function readJsonCookie(request, name) {
  const raw = request.cookies.get(name)?.value;
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded);
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

// Decode the role claim straight from the access_token JWT. This is the
// authoritative source (same one the Header uses) and avoids drift between the
// token and the `user`/`dietician` cookies. Edge-safe: no Node Buffer, returns
// null on any failure so middleware never throws.
function readRoleFromToken(request) {
  const token = request.cookies.get('access_token')?.value;
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json)?.role ?? null;
  } catch {
    return null;
  }
}

// Canonical role aliases. Mirrors ROLE_ALIASES in src/lib/user.js — the JWT and
// some cookies use aliases like `admin`, but the guards below compare against the
// canonical names, so every resolved role must be normalized first.
const ROLE_ALIASES = {
  admin: 'trainer_admin',
  trainer_admin: 'trainer_admin',
  super_admin: 'super_admin',
  trainer: 'trainer',
  dietician: 'trainer',
  client: 'client',
};

function normalizeRole(role) {
  if (!role) return null;
  return ROLE_ALIASES[String(role).trim().toLowerCase()] ?? null;
}

// Resolve role. Prefers the JWT role claim; falls back to the new `user` cookie,
// then the legacy `dietician` cookie which has no role and defaults to 'trainer'.
// Always returns a canonical role name (or null).
function readRole(request) {
  const fromToken = normalizeRole(readRoleFromToken(request));
  if (fromToken) return fromToken;
  const user = readJsonCookie(request, 'user');
  const fromUser = normalizeRole(user?.role);
  if (fromUser) return fromUser;
  const legacy = readJsonCookie(request, 'dietician');
  if (legacy) return 'trainer';
  return null;
}

// Where a logged-in user with a given role belongs. Mirrors landingPathForUser
// in src/lib/user.js but inlined here because middleware can't import client lib.
function homeForRole(role) {
  switch (role) {
    case 'super_admin':   return '/super-admin/overview';
    case 'trainer_admin': return '/trainer-admin/trainers';
    case 'trainer':       return '/trainer/dashboard';
    default:              return '/trainer/dashboard';
  }
}

export function middleware(request) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  const isProtectedRoute =
    pathname.startsWith('/trainer') ||
    pathname.startsWith('/trainer-admin') ||
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/superadmin-trainer');

  // 🔒 Not logged in and visiting protected route → send to login.
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 🛡️ Role-aware guards.
  if (token) {
    const role = readRole(request);

    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
    if (pathname.startsWith('/superadmin-trainer') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
    // /trainer-admin/invites is also open to super_admin (and the `admin`
    // alias) — being a super admin / admin you can invite trainers too.
    // Every other /trainer-admin/* route stays trainer_admin-only.
    if (pathname.startsWith('/trainer-admin/invites')) {
      const inviteRoles = ['trainer_admin', 'admin', 'super_admin'];
      if (!inviteRoles.includes(role)) {
        return NextResponse.redirect(new URL(homeForRole(role), request.url));
      }
    } else if (pathname.startsWith('/trainer-admin') && role !== 'trainer_admin') {
      return NextResponse.redirect(new URL(homeForRole(role), request.url));
    }
    // /trainer/ (with trailing slash) so we don't accidentally match /trainer-admin.
    // trainer_admin (and super_admin) can also view the trainer pages — their
    // header links point here ("View my clients", "Client Directory").
    if (pathname.startsWith('/trainer/')) {
      const trainerRoles = ['trainer', 'trainer_admin', 'super_admin'];
      if (!trainerRoles.includes(role)) {
        return NextResponse.redirect(new URL(homeForRole(role), request.url));
      }
    }
  }

  // Allow accept-invite and signup through even if logged in
  if (pathname === '/accept-invite' || pathname === '/signup') {
    return NextResponse.next();
  }

  // 🔓 Logged in and visiting public auth page → bounce to role-appropriate home.
  const authPages = ['/', '/login', '/register'];
  if (authPages.includes(pathname) && token) {
    const role = readRole(request);
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/accept-invite',
    '/signup',
    '/trainer/:path*',
    '/trainer-admin/:path*',
    '/super-admin/:path*',
    '/superadmin-trainer/:path*',
  ],
};
