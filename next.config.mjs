
import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',

    experimental: {
        cpus: 2,
    },

    outputFileTracingIncludes: {
        '/*': [
            './node_modules/.prisma/**/*',
            './node_modules/@prisma/client/**/*',
            './node_modules/prisma/**/*',
            './node_modules/@node-rs/argon2/**/*',
            './node_modules/@node-rs/argon2-linux-x64-gnu/**/*',
            './node_modules/react-dom/**/*',
        ],
    },

    webpack: (config, { dev }) => {
        if (!dev) {
            config.optimization.minimize = false;
        }

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
