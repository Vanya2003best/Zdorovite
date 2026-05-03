import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Supabase Storage public URLs (avatars/covers/gallery buckets)
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1 MB. Raised so the Cinematic intro-video upload (50 MB cap
      // on the 'videos' Supabase bucket) fits through the Server Action body
      // parser. 60 MB leaves headroom for multipart overhead.
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
