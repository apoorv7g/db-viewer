import type { NextConfig } from "next"; 
 
const nextConfig: NextConfig = { 
  basePath: "/db-viewer", 
  async redirects() { 
    return [ 
      { 
        source: "/", 
        destination: "/dashboard", 
        permanent: false, 
      }, 
    ]; 
  }, 
}; 
 
export default nextConfig; 
