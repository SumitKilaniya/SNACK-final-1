
import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Hostinger production build settings
    experimental: {
        cpus: 2,
    },

    // Temporary diagnostic: disable production JS minification
    webpack: (config, { dev }) => {
        if (!dev) {
            config.optimization.minimize = false;
        }

        // Component tagging is opt-in for development
        if (dev && process.env.ENABLE_COMPONENT_TAGGER === 'true') {
            config.module.rules.push({
                test: /\.(jsx|tsx)$/,
                exclude: [/node_modules/],
                use: [
                    {
                        loader: '@dhiwise/component-tagger/nextLoader',
                    },
                ],
            });

            const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean);

            config.watchOptions = {
                ignored: ignoredPaths.length
                    ? ignoredPaths.map(
                          (p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`
                      )
                    : undefined,
            };
        }

        return config;
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
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
