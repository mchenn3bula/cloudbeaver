/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2024 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */
import { Bootstrap, injectable } from '@cloudbeaver/core-di';
import { CommonDialogService, DialogueStateResult } from '@cloudbeaver/core-dialogs';
import { NotificationService } from '@cloudbeaver/core-events';
import { ACTION_IMPORT, ActionService, DATA_CONTEXT_MENU, menuExtractItems, MenuService } from '@cloudbeaver/core-view';
import {
  DATA_CONTEXT_DV_DDM,
  DATA_CONTEXT_DV_DDM_RESULT_INDEX,
  DATA_VIEWER_DATA_MODEL_ACTIONS_MENU,
  IDatabaseDataSource,
  IDataContainerOptions,
} from '@cloudbeaver/plugin-data-viewer';
import type { IDataQueryOptions } from '@cloudbeaver/plugin-sql-editor';

import { DataImportDialogLazy } from './DataImportDialog/DataImportDialogLazy';
import type { IDataImportDialogState } from './DataImportDialog/IDataImportDialogState';
import { DataImportService } from './DataImportService';

@injectable()
export class DataImportBootstrap extends Bootstrap {
  constructor(
    private readonly menuService: MenuService,
    private readonly actionService: ActionService,
    private readonly notificationService: NotificationService,
    private readonly commonDialogService: CommonDialogService,
    private readonly dataImportService: DataImportService,
  ) {
    super();
  }

  register() {
    this.actionService.addHandler({
      id: 'data-import-base-handler',
      isActionApplicable(context, action) {
        const menu = context.hasValue(DATA_CONTEXT_MENU, DATA_VIEWER_DATA_MODEL_ACTIONS_MENU);
        const model = context.tryGet(DATA_CONTEXT_DV_DDM);
        const resultIndex = context.tryGet(DATA_CONTEXT_DV_DDM_RESULT_INDEX);

        if (!menu || !model || resultIndex === undefined) {
          return false;
        }

        return [ACTION_IMPORT].includes(action);
      },
      isDisabled(context) {
        const model = context.get(DATA_CONTEXT_DV_DDM);
        const resultIndex = context.get(DATA_CONTEXT_DV_DDM_RESULT_INDEX);

        return model.isLoading() || model.isDisabled(resultIndex) || !model.getResult(resultIndex);
      },
      getActionInfo(context, action) {
        if (action === ACTION_IMPORT) {
          return { ...action.info, icon: '/icons/data-import.png' };
        }

        return action.info;
      },
      handler: async (context, action) => {
        const model = context.get(DATA_CONTEXT_DV_DDM);
        const resultIndex = context.get(DATA_CONTEXT_DV_DDM_RESULT_INDEX);

        if (action === ACTION_IMPORT) {
          const result = model.getResult(resultIndex);

          if (!result) {
            throw new Error('Result must be provided');
          }

          const source = model.source as IDatabaseDataSource<IDataContainerOptions & IDataQueryOptions>;

          if (!source.options) {
            throw new Error('Source options must be provided');
          }

          await this.importData();
        }
      },
    });

    this.menuService.addCreator({
      menus: [DATA_VIEWER_DATA_MODEL_ACTIONS_MENU],
      isApplicable: () => !this.dataImportService.disabled,
      getItems(context, items) {
        return [...items, ACTION_IMPORT];
      },
      orderItems(context, items) {
        const extracted = menuExtractItems(items, [ACTION_IMPORT]);
        return [...items, ...extracted];
      },
    });
  }

  private async importData(initialState?: IDataImportDialogState) {
    const state = await this.commonDialogService.open(DataImportDialogLazy, { initialState });

    if (state === DialogueStateResult.Rejected || state === DialogueStateResult.Resolved) {
      return;
    }

    // open dialog with prev state in case of an error
    setTimeout(async () => {
      this.notificationService.logException(new Error('Not implemented'), 'Data import is not implemented');
      await this.importData(state);
    }, 1500);
  }
}
