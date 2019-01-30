/*!
* Contentstack Sync Manager
* Copyright (c) 2019 Contentstack LLC
* MIT Licensed
*/

import Debug from 'debug'
import { cloneDeep, map, remove } from 'lodash'
import { getConfig } from '..'
import { existsSync, mkdirpSync, stat } from './fs'
import { saveFilteredItems } from './unprocessible'
import { validateItemStructure } from './validations'

const debug = Debug('core-utilities')
const formattedAssetType = '_assets'
const formattedContentType = '_content_types'
const assetType = 'sys_assets'

/**
 * @description Utility that filters items based on 'locale'.
 * @param {Object} response - SYNC API's response
 * @param {Object} config - Application config
 * @returns {Promise} Returns a promise
 */
export const filterItems = async (response, config) => {
  return new Promise((resolve, reject) => {
    try {
      const locales = map(config.locales, 'code')
      const filteredObjects = remove(response.items, (item) => {
        // validate item structure. If the structure is not as expected, filter it out
        if (!(validateItemStructure(item))) {

          return item
        }
        // for published items
        if ((item as any).data.publish_details) {
          return locales.indexOf((item as any).data.publish_details.locale) !== -1
        // for unpublished items || deleted items
        } else if ((item as any).data.locale) {
          return locales.indexOf((item as any).data.locale) !== -1
        }

        return false
      })

      if (filteredObjects.length === 0) {
        return resolve()
      }

      // do something with filteredObjects
      let name
      if (response.pagination_token) {
        name = 'pagination_token'
      } else {
        name = 'sync_token'
      }

      return saveFilteredItems(filteredObjects, name, response[name])
        .then(resolve)
        .catch(reject)
    } catch (error) {
      return reject(error)
    }
  })
}

/**
 * @description Groups items based on their content type
 * @param {Array} items - An array of SYNC API's item
 * @returns {Object} Returns an 'object' who's keys are content type uids
 */
export const groupItems = (items) => {
  const bucket = {}
  items.forEach((item) => {
    if (item.content_type_uid === assetType) {
      item.content_type_uid = formattedAssetType
    }
    if (bucket.hasOwnProperty(item.content_type_uid)) {
      bucket[item.content_type_uid].push(item)
    } else  {
      bucket[item.content_type_uid] = [item]
    }
  })

  return bucket
}

/**
 * @description Formats SYNC API's items into defined standard
 * @param {Array} items - SYNC API's items
 * @param {Object} config - Application config
 */
export const formatItems = (items, config) => {
  items.forEach((item) => {
    switch (item.type) {
      case 'asset_published':
        item.content_type_uid = formattedAssetType
        item.action = config.contentstack.actions.publish
        item.locale = item.data.publish_details.locale
        item.uid = item.data.uid
        break
      case 'asset_unpublished':
        item.content_type_uid = formattedAssetType
        item.action = config.contentstack.actions.unpublish
        item.locale = item.data.locale
        item.uid = item.data.uid
        break
      case 'asset_deleted':
        item.content_type_uid = formattedAssetType
        item.action = config.contentstack.actions.delete
        item.locale = item.data.locale
        item.uid = item.data.uid
        break
      case 'entry_published':
        item.action = config.contentstack.actions.publish
        item.locale = item.data.publish_details.locale
        item.uid = item.data.uid
        break
      case 'entry_unpublished':
        item.action = config.contentstack.actions.unpublish
        item.locale = item.data.locale
        item.uid = item.data.uid
        break
      case 'entry_deleted':
        item.action = config.contentstack.actions.delete
        item.locale = item.data.locale
        item.uid = item.data.uid
        break
      case 'content_type_deleted':
        item.action = config.contentstack.actions.delete
        item.uid = item.content_type_uid
        item.content_type_uid = formattedContentType
        break
      default:
        break
    }
  })

  return items
}

/**
 * @description Add's checkpoint data on the last item found on the 'SYNC API items' collection
 * @param {Object} groupedItems - Grouped items { groupItems(items) - see above } referred by their content type
 * @param {Object} syncResponse - SYNC API's response
 */
export const markCheckpoint = (groupedItems, syncResponse) => {
  const tokenName = (syncResponse.pagination_token) ? 'pagination_token' : 'sync_token'
  const tokenValue = syncResponse[tokenName]
  const contentTypeUids = Object.keys(groupedItems)
  if (contentTypeUids.length === 1 && contentTypeUids[0] === '_assets') {
    debug(`Only assets found in SYNC API response. Last content type is ${contentTypeUids[0]}`)
    const items = groupedItems[contentTypeUids[0]]
    // find the last item, add checkpoint to it
    items[items.length - 1].checkpoint = {
      name: tokenName,
      token: tokenValue,
    }
  } else if (contentTypeUids.length === 1 && contentTypeUids[0] === '_content_types') {
    debug(`Only content type events found in SYNC API response. Last content type is ${contentTypeUids[0]}`)
    const items = groupedItems[contentTypeUids[0]]
    // find the last item, add checkpoint to it
    items[items.length - 1].checkpoint = {
      name: tokenName,
      token: tokenValue,
    }
  } else if (contentTypeUids.length === 2 && (contentTypeUids.indexOf('_assets') !== -1 && contentTypeUids.indexOf(
      '_content_types'))) {
        debug(`Assets & content types found found in SYNC API response. Last content type is ${contentTypeUids[1]}`)
        const items = groupedItems[contentTypeUids[1]]
        // find the last item, add checkpoint to it
        items[items.length - 1].checkpoint = {
          name: tokenName,
          token: tokenValue,
        }
  } else {
    const lastContentTypeUid = contentTypeUids[contentTypeUids.length - 1]
    debug(`Mixed content types found in SYNC API response. Last content type is ${lastContentTypeUid}`)
    const entries = groupedItems[lastContentTypeUid]
    entries[entries.length - 1].checkpoint = {
      name: tokenName,
      token: tokenValue,
    }
  }

  return groupedItems
}

/**
 * @description Calcuates filename for ledger and unprocessible files
 * @param {String} file - File to be calculated on
 * @param {Function} rotate - File rotation logic (should return a string)
 * @returns {String} Returns path to a file
 */
export const getFile = (file, rotate) => {
  return new Promise((resolve, reject) => {
    const config = getConfig()
    if (existsSync(file)) {
      return stat(file, (statError, stats) => {
        if (statError) {
          return reject(statError)
        } else if (stats.isFile()) {
          if (stats.size > config['sync-manager'].maxsize) {
            file = rotate()
          }

          return resolve(file)
        } else {
          return reject(new Error(`${file} is not of type file`))
        }
      })
    } else {
      mkdirpSync(config.paths.unprocessibleDir)

      return resolve(file)
    }
  })
}

export const buildContentReferences = (schema: any[], entry: any, parent: string[] = []) => {
  const config = getConfig()
  const enableAssetReferences = config['sync-manager'].enableAssetReferences
  const enableContentReferences = config['sync-manager'].enableContentReferences
  for (let i = 0, c = schema.length; i < c; i++) {
    switch (schema[i].data_type) {
    case 'reference':
      if (enableAssetReferences) {
        parent.push(schema[i].uid)
        update(parent, schema[i].reference_to, entry)
        parent.pop()
      }
      break
    case 'file':
      if (enableContentReferences) {
        parent.push(schema[i].uid)
        update(parent, '_assets', entry)
        parent.pop()
      }
      break
    case 'group':
      parent.push(schema[i].uid)
      buildContentReferences(schema[i].schema, entry, parent)
      parent.pop()
      break
    case 'blocks':
      for (let j = 0, d = schema[i].blocks.length; j < d; j++) {
        parent.push(schema[i].uid)
        parent.push(schema[i].blocks[j].uid)
        buildContentReferences(schema[i].blocks[j].schema, entry, parent)
        parent.pop()
        parent.pop()
      }
      break
    }
  }

  return entry
}

const update = (parent, reference, entry) => {
  const len = parent.length
  for (let j = 0; j < len; j++) {
    if (entry && parent[j]) {
      if (j === (len - 1) && entry[parent[j]]) {
        if (reference !== '_assets') {
          entry[parent[j]] = {
            reference_to: reference,
            values: entry[parent[j]],
          }
        } else {
          if (Array.isArray(entry[parent[j]])) {
            const assetIds = []
            for (let k = 0; k < entry[parent[j]].length; k++) {
              assetIds.push(entry[parent[j]][k])
            }
            entry[parent[j]] = {
              reference_to: reference,
              values: assetIds,
            }
          } else {
            entry[parent[j]] = {
              reference_to: reference,
              values: entry[parent[j]],
            }
          }
        }
      } else {
        entry = entry[parent[j]]
        const keys = cloneDeep(parent).splice((j + 1), len)
        if (Array.isArray(entry)) {
          for (let i = 0, l = entry.length; i < l; i++) {
            update(keys, reference, entry[i])
          }
        } else if (typeof entry !== 'object') {
          break
        }
      }
    }
  }
}
