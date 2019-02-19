"use strict";
/*!
* Contentstack Sync Manager
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const lodash_1 = require("lodash");
const url_1 = require("url");
const __1 = require("..");
const fs_1 = require("./fs");
const logger_1 = require("./logger");
const unprocessible_1 = require("./unprocessible");
const validations_1 = require("./validations");
const debug = debug_1.default('core-utilities');
const formattedAssetType = '_assets';
const formattedContentType = '_content_types';
const assetType = 'sys_assets';
exports.filterItems = (response, config) => __awaiter(this, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        try {
            const locales = lodash_1.map(config.locales, 'code');
            const filteredObjects = lodash_1.remove(response.items, (item) => {
                if (!(validations_1.validateItemStructure(item))) {
                    return item;
                }
                if (item.data.publish_details) {
                    return locales.indexOf(item.data.publish_details.locale) !== -1;
                }
                else if (item.data.locale) {
                    return locales.indexOf(item.data.locale) !== -1;
                }
                return false;
            });
            if (filteredObjects.length === 0) {
                return resolve();
            }
            let name;
            if (response.pagination_token) {
                name = 'pagination_token';
            }
            else {
                name = 'sync_token';
            }
            return unprocessible_1.saveFilteredItems(filteredObjects, name, response[name])
                .then(resolve)
                .catch(reject);
        }
        catch (error) {
            return reject(error);
        }
    });
});
exports.groupItems = (items) => {
    const bucket = {};
    items.forEach((item) => {
        if (item.content_type_uid === assetType) {
            item.content_type_uid = formattedAssetType;
        }
        if (bucket.hasOwnProperty(item.content_type_uid)) {
            bucket[item.content_type_uid].push(item);
        }
        else {
            bucket[item.content_type_uid] = [item];
        }
    });
    return bucket;
};
exports.formatItems = (items, config) => {
    items.forEach((item) => {
        switch (item.type) {
            case 'asset_published':
                item.content_type_uid = formattedAssetType;
                item.action = config.contentstack.actions.publish;
                item.locale = item.data.publish_details.locale;
                item.uid = item.data.uid;
                break;
            case 'asset_unpublished':
                item.content_type_uid = formattedAssetType;
                item.action = config.contentstack.actions.unpublish;
                item.locale = item.data.locale;
                item.uid = item.data.uid;
                break;
            case 'asset_deleted':
                item.content_type_uid = formattedAssetType;
                item.action = config.contentstack.actions.delete;
                item.locale = item.data.locale;
                item.uid = item.data.uid;
                break;
            case 'entry_published':
                item.action = config.contentstack.actions.publish;
                item.locale = item.data.publish_details.locale;
                item.uid = item.data.uid;
                break;
            case 'entry_unpublished':
                item.action = config.contentstack.actions.unpublish;
                item.locale = item.data.locale;
                item.uid = item.data.uid;
                break;
            case 'entry_deleted':
                item.action = config.contentstack.actions.delete;
                item.locale = item.data.locale;
                item.uid = item.data.uid;
                break;
            case 'content_type_deleted':
                item.action = config.contentstack.actions.delete;
                item.uid = item.content_type_uid;
                item.content_type_uid = formattedContentType;
                break;
            default:
                break;
        }
    });
    return items;
};
exports.markCheckpoint = (groupedItems, syncResponse) => {
    const tokenName = (syncResponse.pagination_token) ? 'pagination_token' : 'sync_token';
    const tokenValue = syncResponse[tokenName];
    const contentTypeUids = Object.keys(groupedItems);
    if (contentTypeUids.length === 1 && contentTypeUids[0] === '_assets') {
        debug(`Only assets found in SYNC API response. Last content type is ${contentTypeUids[0]}`);
        const items = groupedItems[contentTypeUids[0]];
        items[items.length - 1].checkpoint = {
            name: tokenName,
            token: tokenValue,
        };
    }
    else if (contentTypeUids.length === 1 && contentTypeUids[0] === '_content_types') {
        debug(`Only content type events found in SYNC API response. Last content type is ${contentTypeUids[0]}`);
        const items = groupedItems[contentTypeUids[0]];
        items[items.length - 1].checkpoint = {
            name: tokenName,
            token: tokenValue,
        };
    }
    else if (contentTypeUids.length === 2 && (contentTypeUids.indexOf('_assets') !== -1 && contentTypeUids.indexOf('_content_types'))) {
        debug(`Assets & content types found found in SYNC API response. Last content type is ${contentTypeUids[1]}`);
        const items = groupedItems[contentTypeUids[1]];
        items[items.length - 1].checkpoint = {
            name: tokenName,
            token: tokenValue,
        };
    }
    else {
        const lastContentTypeUid = contentTypeUids[contentTypeUids.length - 1];
        debug(`Mixed content types found in SYNC API response. Last content type is ${lastContentTypeUid}`);
        const entries = groupedItems[lastContentTypeUid];
        entries[entries.length - 1].checkpoint = {
            name: tokenName,
            token: tokenValue,
        };
    }
    return groupedItems;
};
exports.getFile = (file, rotate) => {
    return new Promise((resolve, reject) => {
        const config = __1.getConfig();
        if (fs_1.existsSync(file)) {
            return fs_1.stat(file, (statError, stats) => {
                if (statError) {
                    return reject(statError);
                }
                else if (stats.isFile()) {
                    if (stats.size > config.syncManager.maxsize) {
                        file = rotate();
                    }
                    return resolve(file);
                }
                else {
                    return reject(new Error(`${file} is not of type file`));
                }
            });
        }
        else {
            fs_1.mkdirpSync(config.paths.unprocessibleDir);
            return resolve(file);
        }
    });
};
exports.buildContentReferences = (schema, entry, parent = []) => {
    const config = __1.getConfig();
    const enableAssetReferences = config.syncManager.enableAssetReferences;
    const enableContentReferences = config.syncManager.enableContentReferences;
    for (let i = 0, c = schema.length; i < c; i++) {
        switch (schema[i].data_type) {
            case 'reference':
                if (enableAssetReferences) {
                    parent.push(schema[i].uid);
                    update(parent, schema[i].reference_to, entry);
                    parent.pop();
                }
                break;
            case 'file':
                if (enableContentReferences) {
                    parent.push(schema[i].uid);
                    update(parent, '_assets', entry);
                    parent.pop();
                }
                break;
            case 'group':
                parent.push(schema[i].uid);
                exports.buildContentReferences(schema[i].schema, entry, parent);
                parent.pop();
                break;
            case 'blocks':
                for (let j = 0, d = schema[i].blocks.length; j < d; j++) {
                    parent.push(schema[i].uid);
                    parent.push(schema[i].blocks[j].uid);
                    exports.buildContentReferences(schema[i].blocks[j].schema, entry, parent);
                    parent.pop();
                    parent.pop();
                }
                break;
        }
    }
    return entry;
};
const update = (parent, reference, entry) => {
    const len = parent.length;
    for (let j = 0; j < len; j++) {
        if (entry && parent[j]) {
            if (j === (len - 1) && entry[parent[j]]) {
                if (reference !== '_assets') {
                    entry[parent[j]] = {
                        reference_to: reference,
                        values: entry[parent[j]],
                    };
                }
                else {
                    if (Array.isArray(entry[parent[j]])) {
                        const assetIds = [];
                        for (let k = 0; k < entry[parent[j]].length; k++) {
                            assetIds.push(entry[parent[j]][k]);
                        }
                        entry[parent[j]] = {
                            reference_to: reference,
                            values: assetIds,
                        };
                    }
                    else {
                        entry[parent[j]] = {
                            reference_to: reference,
                            values: entry[parent[j]],
                        };
                    }
                }
            }
            else {
                entry = entry[parent[j]];
                const keys = lodash_1.cloneDeep(parent).splice((j + 1), len);
                if (Array.isArray(entry)) {
                    for (let i = 0, l = entry.length; i < l; i++) {
                        update(keys, reference, entry[i]);
                    }
                }
                else if (typeof entry !== 'object') {
                    break;
                }
            }
        }
    }
};
const findAssets = (parentEntry, key, schema, entry, bucket, isFindNotReplace) => {
    var matches, regexp;
    const isMarkdown = (schema.field_metadata.markdown) ? true : false;
    if (isMarkdown) {
        regexp = new RegExp('(https://(assets|images).contentstack.io/v[\\d]/assets/(.*?)/(.*?)/(.*?)/(.*))', 'g');
    }
    else {
        regexp = new RegExp('[\"](https://(assets|images).contentstack.io/v[\\d]/assets/(.*?)/(.*?)/(.*?)/(.*?))[\"]', 'g');
    }
    while ((matches = regexp.exec(entry)) !== null) {
        if (matches && matches.length) {
            const assetObject = {};
            let assetUrl = matches[1];
            if (matches[5]) {
                assetObject.uid = matches[5];
            }
            if (matches[1]) {
                assetObject.url = assetUrl;
                assetObject.download_id = url_1.parse(assetUrl).pathname.split('/').slice(4).join('/');
            }
            if (isFindNotReplace) {
                bucket.push(assetObject);
            }
            else {
                const asset = lodash_1.find(bucket, (item) => {
                    return item.data.download_id === assetObject.download_id;
                });
                if (typeof asset !== 'undefined') {
                    if (isMarkdown) {
                        parentEntry[key] = entry.replace(assetUrl, `${encodeURI(asset.data._internal_url)}\\n`);
                    }
                    else {
                        parentEntry[key] = entry.replace(assetUrl, encodeURI(asset.data._internal_url));
                    }
                }
            }
        }
    }
};
const get = (parent, schema, entry, bucket, isFindNotReplace) => {
    try {
        const len = parent.length;
        for (let j = 0; j < len; j++) {
            const subEntry = entry[parent[j]];
            if (j === (len - 1) && subEntry) {
                if (subEntry instanceof Array) {
                    for (let i = 0, _i = subEntry.length; i < _i; i++) {
                        findAssets(entry, parent[j], schema, subEntry[i], bucket, isFindNotReplace);
                    }
                }
                else {
                    findAssets(entry, parent[j], schema, subEntry, bucket, isFindNotReplace);
                }
            }
            else {
                const keys = lodash_1.cloneDeep(parent).splice((j + 1), len);
                if (subEntry instanceof Array) {
                    for (let m = 0, _m = subEntry.length; m < _m; m++) {
                        get(keys, schema, subEntry[m], bucket, isFindNotReplace);
                    }
                }
                else if (typeof subEntry !== 'object') {
                    break;
                }
            }
        }
    }
    catch (error) {
        logger_1.logger.error(error);
    }
};
exports.getOrSetRTEMarkdownAssets = (schema, entry, bucket = [], isFindNotReplace, parent = []) => {
    for (let i = 0, _i = schema.length; i < _i; i++) {
        if (schema[i].data_type === 'text' && (schema[i].field_metadata.markdown) || schema[i].field_metadata.rich_text_type) {
            parent.push(schema[i].uid);
            get(parent, schema[i], entry, bucket, isFindNotReplace);
            parent.pop();
        }
        else if (schema[i].data_type === 'group') {
            parent.push(schema[i].uid);
            entry = exports.getOrSetRTEMarkdownAssets(schema[i].schema, entry, bucket, isFindNotReplace, parent);
            parent.pop();
        }
        else if (schema[i].data_type === 'blocks') {
            for (let j = 0, _j = schema[i].blocks.length; j < _j; j++) {
                parent.push(schema[i].uid);
                parent.push(schema[i].blocks[j].uid);
                entry = exports.getOrSetRTEMarkdownAssets(schema[i].blocks[j].schema, entry, isFindNotReplace, bucket, parent);
                parent.pop();
                parent.pop();
            }
        }
    }
    if (isFindNotReplace) {
        return bucket;
    }
    return entry;
};
