/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",

  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,

  "style-src 'self' 'unsafe-inline'",

  "img-src 'self' data: blob: https://api.respyr.ai https://respyr.in https://production-us.fitchef.cloud https://humorstech.com",

  "font-src 'self' data:",

  // "connect-src 'self' https://api.respyr.ai https://respyr.in blob: data:",


  "connect-src 'self' https://api.respyr.ai https://respyr.in https://metabolism-dashboard-termsconditions-agreements.s3.us-west-2.amazonaws.com blob: data:",


  "object-src 'none'",

  "base-uri 'self'",

  "form-action 'self'",

  "frame-ancestors 'none'",

  "worker-src 'self' blob:",

  ...(!isDev ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig = {
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.respyr.ai",
      },
    ],
  },

 async headers() {
  return [
    {
      source: "/",
      headers: [
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy,
        },
        {
          key: "Cache-Control",
          value: "private, no-store, no-cache, must-revalidate",
        },
      ],
    },
    {
      source: "/:path*",
      headers: [
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy,
        },
      ],
    },
  ];
},


  async redirects() {
    const movedRoutes = [
      "dashboard",
      "client",
      "diet-plan",
      "planhistory",
      "plansummary",
      "profile",
      "settings",
      "testlog-info",
      "messages",
      "updatepassword",
      "earnings",
    ];

    const moved = movedRoutes.flatMap((route) => [
      {
        source: `/${route}`,
        destination: `/trainer/${route}`,
        permanent: true,
      },
      {
        source: `/${route}/:path*`,
        destination: `/trainer/${route}/:path*`,
        permanent: true,
      },
    ]);

    return [
      ...moved,

      {
        source: "/accept-invite.php",
        destination: "/accept-invite",
        permanent: false,
      },

      {
        source: "/partners/clients-profile",
        destination: "/trainer/clients-profile",
        permanent: true,
      },

      {
        source: "/partners",
        destination: "/trainer/dashboard",
        permanent: true,
      },

      {
        source: "/partners/:path*",
        destination: "/trainer/dashboard",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;









// /** @type {import('next').NextConfig} */


// const isDev = process.env.NODE_ENV === "development";

// const contentSecurityPolicy = [
//   "default-src 'self'",
//   `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
//   "style-src 'self' 'unsafe-inline'",
//   "img-src 'self' data: blob: https://api.respyr.ai https://humorstech.com",
//   "font-src 'self' data:",
//   "connect-src 'self' https://api.respyr.ai https://respyr.in blob: data:",
//   "object-src 'none'",
//   "base-uri 'self'",
//   "form-action 'self'",
//   "frame-ancestors 'none'",
//   "worker-src 'self' blob:",
//   "upgrade-insecure-requests",
// ].join("; ");


// const nextConfig = {
//   poweredByHeader: false,
//   images: {
//     remotePatterns: [
//       // { protocol: 'https', hostname: 'humorstech.com' },
//       // { protocol: 'https', hostname: 'www.admin.respyr.ai' },
//       { protocol: 'https', hostname: 'api.respyr.ai' },
//     ],
//   },



//     async headers() {
//     return [
//       {
//        source: "/:path*",
//         headers: [
//           {
//             key: "Content-Security-Policy",
//             value: contentSecurityPolicy,
//           },
//         ],
//       },
//     ];
//   },



//   // Phase 1 route migration: old top-level routes were moved under /trainer/*.
//   // 308 (permanent) redirects keep existing bookmarks, in-flight links, and
//   // any external references working. The wildcard rules cover deep paths
//   // (e.g., /client/123 -> /trainer/client/123). The bare-path rules cover
//   // the directory roots themselves.
//   //
//   // /partners/* is gone entirely — redirects to /trainer/dashboard so anyone
//   // with a stale partner link lands somewhere useful.
//   async redirects() {
//     const movedRoutes = [
//       'dashboard',
//       'client',
//       'diet-plan',
//       'planhistory',
//       'plansummary',
//       'profile',
//       'settings',
//       'testlog-info',
//       'messages',
//       'updatepassword',
//       'earnings',
//     ];

//     const moved = movedRoutes.flatMap((route) => [
//       { source: `/${route}`,        destination: `/trainer/${route}`,        permanent: true },
//       { source: `/${route}/:path*`, destination: `/trainer/${route}/:path*`, permanent: true },
//     ]);

//     return [
//       ...moved,
//       // accept-invite.php → accept-invite (backend emails use .php extension)
//       { source: '/accept-invite.php', destination: '/accept-invite', permanent: false },
//       // Partners track removed in Phase 1, but the partners-only client
//       // profile page lives under /trainer/clients-profile now. Specific
//       // redirect must come BEFORE the catch-all below so query params (e.g.,
//       // ?profile_id=...) are preserved.
//       { source: '/partners/clients-profile', destination: '/trainer/clients-profile', permanent: true },
//       { source: '/partners',        destination: '/trainer/dashboard', permanent: true },
//       { source: '/partners/:path*', destination: '/trainer/dashboard', permanent: true },
//     ];
//   },
// };

// export default nextConfig;
