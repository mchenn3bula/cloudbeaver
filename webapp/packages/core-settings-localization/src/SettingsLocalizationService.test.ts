/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2024 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */
import '@testing-library/jest-dom';

import { coreClientActivityManifest } from '@cloudbeaver/core-client-activity';
import { coreLocalizationManifest } from '@cloudbeaver/core-localization';
import { coreRootManifest, ServerConfigResource } from '@cloudbeaver/core-root';
import { createGQLEndpoint } from '@cloudbeaver/core-root/dist/__custom_mocks__/createGQLEndpoint';
import { mockAppInit } from '@cloudbeaver/core-root/dist/__custom_mocks__/mockAppInit';
import { mockGraphQL } from '@cloudbeaver/core-root/dist/__custom_mocks__/mockGraphQL';
import { mockServerConfig } from '@cloudbeaver/core-root/dist/__custom_mocks__/resolvers/mockServerConfig';
import { coreSDKManifest } from '@cloudbeaver/core-sdk';
import { coreSettingsManifest } from '@cloudbeaver/core-settings';
import { createApp } from '@cloudbeaver/tests-runner';

import { coreSettingsLocalizationManifest } from './manifest';
import { SettingsLocalizationService } from './SettingsLocalizationService';

const endpoint = createGQLEndpoint();
const app = createApp(
  coreSettingsLocalizationManifest,
  coreClientActivityManifest,
  coreSettingsManifest,
  coreLocalizationManifest,
  coreRootManifest,
  coreSDKManifest,
);

const server = mockGraphQL(...mockAppInit(endpoint));

beforeAll(() => app.init());

const testValue = 'es';
const testValueB = 'te';

const deprecatedSettings = {
  'core.user.defaultLanguage': testValueB,
};

const newSettings = {
  ...deprecatedSettings,
  'core.localization.language': testValueB,
};

test('New settings override deprecated settings', async () => {
  const settings = app.injector.getServiceByClass(SettingsLocalizationService);
  const config = app.injector.getServiceByClass(ServerConfigResource);

  server.use(endpoint.query('serverConfig', mockServerConfig(newSettings)));

  await config.refresh();

  expect(settings.language).toBe(testValue);
});

test('Deprecated settings are used if new settings are not defined', async () => {
  const settings = app.injector.getServiceByClass(SettingsLocalizationService);
  const config = app.injector.getServiceByClass(ServerConfigResource);

  server.use(endpoint.query('serverConfig', mockServerConfig(deprecatedSettings)));

  await config.refresh();

  expect(settings.language).toBe(testValueB);
});
