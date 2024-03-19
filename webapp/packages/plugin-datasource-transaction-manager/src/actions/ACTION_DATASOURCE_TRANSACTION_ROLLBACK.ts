/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2024 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */
import { createAction } from '@cloudbeaver/core-view';

export const ACTION_DATASOURCE_TRANSACTION_ROLLBACK = createAction('datasource-transaction-rollback', {
  label: 'plugin_datasource_transaction_manager_rollback',
  tooltip: 'plugin_datasource_transaction_manager_rollback',
  icon: '/icons/rollback_m.svg',
});
