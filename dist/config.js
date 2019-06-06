"use strict";
/*!
* Contentstack DataSync Manager
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @description Default application's internal config
 */
exports.config = {
    assetStore: {},
    contentStore: {},
    contentstack: {
        MAX_RETRY_LIMIT: 6,
        actions: {
            delete: 'delete',
            publish: 'publish',
            unpublish: 'unpublish',
        },
        apis: {
            content_types: '/v3/content_types/',
            sync: '/v3/stacks/sync',
        },
        host: 'cdn.contentstack.io',
        port: 443,
        protocol: 'https:',
        verbs: {
            get: 'GET',
        },
    },
    listener: {},
    locales: [],
    plugins: [
        {
            name: '_cs_internal_transform_entries',
            // path: '',
            disabled: false,
            options: {
            // other overrides...
            },
        },
        {
            name: '_cs_internal_transform_schemas',
            disabled: false,
            options: {
                logAssetPaths: true,
                logReferencePaths: true,
            },
        },
        {
            name: '_cs_internal_save_rte_markdown_assets',
            disabled: false,
            options: {
            // other overrides...
            },
        }
    ],
    syncManager: {
        cooloff: 3000,
        enableAssetReferences: true,
        enableContentReferences: true,
        enableRteMarkdownDownload: true,
        inet: {
            dns: '8.8.8.8',
            host: 'contentstack.io',
            // DNS port
            port: 53,
            retries: 5,
            retryTimeout: 20 * 1000,
            retryIncrement: 5 * 1000,
            timeout: 10 * 1000,
            type: 'A',
        },
        limit: 100,
        markdown: {
            gfm: true,
            tables: true,
            breaks: true,
            smartLists: true,
            xhtml: false
        },
        // max file sizes in bytes
        maxsize: 2097152,
        queue: {
            pause_threshold: 10000,
            resume_threshold: 5000
        },
        saveFailedItems: true,
        saveFilteredItems: true,
    },
};
