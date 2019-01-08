import { cloneDeep, merge } from 'lodash'
import nock from 'nock'
import { setAssetConnector, setConfig, setContentConnector, setListener, start } from '../src'
import { config as internalConfig } from '../src/defaults'
import { contentType as contentTypeSchema } from './dummy/api-responses/content-type'
import { response as publishResponse } from './dummy/api-responses/publish'
import { response as unpublishResponse } from './dummy/api-responses/unpublish'
import { config } from './dummy/config'
import { assetConnector, contentConnector, listener } from './dummy/connector-listener-instances'

beforeEach(() => {
  nock('https://api.localhost.io', { reqheaders: {
    'accept': 'application/json',
    'access_token': 'dummyDeliveryToken',
    'api_key': 'dummyApiKey',
    'host': 'api.localhost.io',
    'x-user-agent': 'contentstack-sync-manager',
  }})
    .get('/stacks/sync/publish-success')
    .query({sync_token: 'dummySyncToken', environment: 'development', limit: 100})
    .reply(200, publishResponse)
  nock('https://api.localhost.io', { reqheaders: {
      'accept': 'application/json',
      'access_token': 'dummyDeliveryToken',
      'api_key': 'dummyApiKey',
      'host': 'api.localhost.io',
      'x-user-agent': 'contentstack-sync-manager',
    }})
      .get('/stacks/sync/unpublish-success')
      .query({sync_token: 'dummySyncToken', environment: 'development', limit: 100})
      .reply(200, unpublishResponse)
  nock('https://api.localhost.io')
    .get('/content_types/authors')
    .reply(200, contentTypeSchema)
  nock('https://api.localhost.io')
    .get('/stacks/sync/unpublish-success')
    .reply(200, publishResponse)
})

test('set content connector without errors', () => {
  expect(setContentConnector(contentConnector)).toBeUndefined()
})

test('set asset connector without errors', () => {
  expect(setAssetConnector(assetConnector)).toBeUndefined()
})

test('set listener without errors', () => {
  expect(setListener(listener)).toBeUndefined()
})

test('set config without errors', () => {
  expect(setConfig(config)).toBeUndefined()
})

test('process publish data without errors', () => {
  const result = {
    status: 'App started successfully!',
  }
  const configs = cloneDeep(merge({}, config, internalConfig))
  const contentstack = configs.contentstack
  contentstack.sync_token = 'dummySyncToken'
  contentstack.cdn = 'https://api.localhost.io'
  contentstack.restAPIS.sync += '/publish-success'
  setContentConnector(contentConnector)
  setAssetConnector(assetConnector)
  setListener(listener)

  return start(configs).then((status) => {
    expect(status).toEqual(result)
  })
})

test('process unpublish data without errors', () => {
  const result = {
    status: 'App started successfully!',
  }
  const configs = cloneDeep(merge({}, config, internalConfig))
  const contentstack = configs.contentstack
  contentstack.sync_token = 'dummySyncToken'
  contentstack.cdn = 'https://api.localhost.io'
  contentstack.restAPIS.sync += '/unpublish-success'
  setContentConnector(contentConnector)
  setAssetConnector(assetConnector)
  setListener(listener)

  return start(configs).then((status) => {
    expect(status).toEqual(result)
  })
})

test('process deleted data without errors', () => {
  const result = {
    status: 'App started successfully!',
  }
  const configs = cloneDeep(merge({}, config, internalConfig))
  const contentstack: any = configs.contentstack
  contentstack.pagination_token = 'dummyPaginationToken'
  contentstack.cdn = 'https://api.localhost.io'
  contentstack.restAPIS.sync += '/delete-success'
  setContentConnector(contentConnector)
  setAssetConnector(assetConnector)
  setListener(listener)

  return start(configs).then((status) => {
    expect(status).toEqual(result)
  })
})
