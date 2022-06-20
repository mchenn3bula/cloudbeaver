/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { NavNodeManagerService, INodeNavigationData, ITab, NavigationTabsService } from '@cloudbeaver/core-app';
import { ConnectionsManagerService, IConnectionExecutorData } from '@cloudbeaver/core-connections';
import { injectable } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';
import { ExecutorInterrupter, IExecutionContextProvider } from '@cloudbeaver/core-executor';
import { DBObjectPageService, ObjectPage, ObjectViewerTabService, IObjectViewerTabState, isObjectViewerTab } from '@cloudbeaver/plugin-object-viewer';

import { DataViewerPanel } from './DataViewerPage/DataViewerPanel';
import { DataViewerTab } from './DataViewerPage/DataViewerTab';
import { DataViewerTableService } from './DataViewerTableService';
import type { IDataViewerPageState } from './IDataViewerPageState';

@injectable()
export class DataViewerTabService {
  readonly page: ObjectPage<IDataViewerPageState>;

  constructor(
    private readonly navNodeManagerService: NavNodeManagerService,
    private readonly dataViewerTableService: DataViewerTableService,
    private readonly objectViewerTabService: ObjectViewerTabService,
    private readonly dbObjectPageService: DBObjectPageService,
    private readonly notificationService: NotificationService,
    private readonly connectionsManagerService: ConnectionsManagerService,
    private readonly navigationTabsService: NavigationTabsService,
  ) {
    this.page = this.dbObjectPageService.register({
      key: 'data_viewer_data',
      priority: 2,
      order: 2,
      getTabComponent: () => DataViewerTab,
      getPanelComponent: () => DataViewerPanel,
      onRestore: this.handleTabRestore.bind(this),
      canClose: this.handleTabCanClose.bind(this),
      onClose: this.handleTabClose.bind(this),
    });
  }

  register() {
    this.connectionsManagerService.onDisconnect.addHandler(this.disconnectHandler.bind(this));
  }

  registerTabHandler(): void {
    this.navNodeManagerService.navigator.addHandler(this.navigationHandler.bind(this));
  }

  private async disconnectHandler(
    data: IConnectionExecutorData,
    contexts: IExecutionContextProvider<IConnectionExecutorData>
  ) {
    if (data.state === 'before') {
      const tabs = Array.from(this.navigationTabsService.findTabs(
        isObjectViewerTab(tab => data.connections.includes(tab.handlerState.connectionId ?? ''))
      ));

      for (const tab of tabs) {
        const canClose = await this.handleTabCanClose(tab);

        if (!canClose) {
          ExecutorInterrupter.interrupt(contexts);
          return;
        }
      }
    }
  }

  private async navigationHandler(data: INodeNavigationData, contexts: IExecutionContextProvider<INodeNavigationData>) {
    try {
      const {
        nodeInfo,
        tabInfo,
        trySwitchPage,
      } = await contexts.getContext(this.objectViewerTabService.objectViewerTabContext);

      const node = await this.navNodeManagerService.loadNode(nodeInfo);

      if (!this.navNodeManagerService.isNodeHasData(node)) {
        return;
      }

      if (tabInfo.isNewlyCreated) {
        trySwitchPage(this.page);
      }
    } catch (exception: any) {
      this.notificationService.logException(exception, 'Data Viewer Error', 'Error in Data Viewer while processing action with database node');
    }
  }

  private async handleTabRestore(tab: ITab<IObjectViewerTabState>) {
    return true;
  }

  private async handleTabCanClose(tab: ITab<IObjectViewerTabState>): Promise<boolean> {
    const model = this.dataViewerTableService.get(tab.handlerState.tableId || '');

    if (model) {
      let canClose = false;
      try {
        await model.requestDataAction(() => {
          canClose = true;
        });
      } catch { }

      return canClose;
    }

    return true;
  }

  private handleTabClose(tab: ITab<IObjectViewerTabState>) {
    if (tab.handlerState.tableId) {
      this.dataViewerTableService.removeTableModel(tab.handlerState.tableId);
    }
  }
}
