import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    productionBrowserSourceMaps: true,
    typescript: {
        ignoreBuildErrors: true,
    },
    // Bound the page-data worker pool. This app's module graph is large and
    // build servers often run in memory-capped containers (2 GiB cgroups,
    // small PaaS plans) where the default `cpus - 1` workers (48 here) OOM
    // and get SIGKILL'd mid-build. Two workers keep peak RSS under ~1.5 GiB;
    // builds are slightly slower on big machines, reliably green on small ones.
    experimental: {
        cpus: 2,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: imageHosts,
        minimumCacheTTL: 60,
        qualities: [75, 85, 100],
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },
    webpack(
        config,
        {
            dev: dev
        }
    ) {
        if (dev) {
            config.module.rules.push({
                test: /\.(jsx|tsx)$/,
                exclude: [/node_modules/],
                use: [{
                    loader: '@dhiwise/component-tagger/nextLoader',
                }],
            });
            const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean);
            config.watchOptions = {
                ignored: ignoredPaths.length
                    ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
                    : undefined,
            };
        }
        return config;
    },
};
export default nextConfig;