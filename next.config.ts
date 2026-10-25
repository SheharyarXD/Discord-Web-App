import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The administration reads the parser vocabulary from disk at run time; serverless tracing would leave it out.
  outputFileTracingIncludes: { "/admin/**/*": ["./data/reference/lexicon.json"], "/admin": ["./data/reference/lexicon.json"] },
  /**
   * While the Gems section is switched off its address answers 404 straight away. The pages also refuse
   * on their own, but those run inside a streaming boundary and would answer 200 with an empty not-found view.
   */
  async rewrites() {
    if (process.env.FEATURE_GEMS === "true") return [];
    // beforeFiles: a rewrite normally yields to an existing page, and /gems is one.
    return {
      beforeFiles: [
        { source: "/gems", destination: "/section-not-available" },
        { source: "/gems/:path*", destination: "/section-not-available" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
