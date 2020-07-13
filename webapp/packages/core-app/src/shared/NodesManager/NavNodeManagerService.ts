/*
 * cloudbeaver - Cloud Database Manager
 * Copyright (C) 2020 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { injectable } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';
import { PermissionsService, EPermission } from '@cloudbeaver/core-root';
import { GraphQLService, resourceKeyList } from '@cloudbeaver/core-sdk';

import { ConnectionAuthService } from '../ConnectionsManager/ConnectionAuthService';
import { Connection } from '../ConnectionsManager/ConnectionInfoResource';
import { INavigator } from '../Navigation/INavigator';
import { IContextProvider } from '../Navigation/NavigationContext';
import { NavigationService } from '../Navigation/NavigationService';
import { ENodeFeature } from './ENodeFeature';
import { NavNodeInfo, NavNode } from './EntityTypes';
import { EObjectFeature } from './EObjectFeature';
import { NavNodeInfoResource, ROOT_NODE_PATH } from './NavNodeInfoResource';
import { NavTreeResource } from './NavTreeResource';
import { NodeManagerUtils } from './NodeManagerUtils';

export enum NavigationType {
  open,
  closeConnection
}

export interface NavNodeKey {
  nodeId: string;
  parentId: string;
}

export interface NavNodeValue {
  node: NavNodeInfo;
  parentId?: string;
}

export interface INodeContainerInfo {
  connectionId?: string;
  catalogId?: string;
  schemaId?: string;
}

export interface INavNodePath {
  nodes: NavNodeKey[];
  remove?: boolean;
  navNodeId?: never;
  nodesValue?: never;
}

export interface INavNodeData {
  nodesValue: NavNodeValue[];
  navNodeId?: never;
  nodes?: never;
  remove?: never;
}

export interface INavNodeId {
  navNodeId: string[];
  remove?: boolean;
  nodes?: never;
  nodesValue?: never;
}

export interface INodeNavigationContext {
  type: NavigationType;
  nodeId: string;
  parentId: string;
  folderId: string;
  name?: string;
  icon?: string;
  getParents: () => string[];
  loadParents: (parents: string[]) => Promise<void>;
}

export interface INodeNavigationData {
  type: NavigationType;
  nodeId: string;
  parentId: string;
  folderId?: string;
}

@injectable()
export class NavNodeManagerService {
  readonly navigator!: INavigator<INodeNavigationData>;

  constructor(
    private graphQLService: GraphQLService,
    private navigationService: NavigationService,
    private permissionsService: PermissionsService,
    readonly navTree: NavTreeResource,
    readonly navNodeInfoResource: NavNodeInfoResource,
    private connectionAuthService: ConnectionAuthService,
    private notificationService: NotificationService,
  ) {

    this.navigator = this.navigationService.createNavigator<INodeNavigationData>(
      data => data.nodeId,
      this.navigateHandler.bind(this),
      {
        type: NavigationType.open,
        nodeId: ROOT_NODE_PATH,
        parentId: ROOT_NODE_PATH,
      }
    );
  }

  async navToNode(nodeId: string, parentId: string, folderId?: string) {
    await this.navigator.navigateTo({
      type: NavigationType.open,
      nodeId,
      parentId,
      folderId,
    });
  }

  async refreshTree(navNodeId: string) {
    await this.graphQLService.gql.navRefreshNode({
      nodePath: navNodeId,
    });
    this.navTree.markOutdated(resourceKeyList(this.navTree.getNestedChildren(navNodeId)));
    await this.navTree.refresh(navNodeId);
  }

  async updateRootChildren() {
    if (!await this.permissionsService.hasAsync(EPermission.public)) {
      this.navTree.delete(ROOT_NODE_PATH);
      return;
    }
    await this.navTree.refresh(ROOT_NODE_PATH);
  }

  getTree(navNodeId: string): string[] | undefined
  getTree(navNodeKey: NavNodeKey): string[] | undefined
  getTree(navNodeKey: NavNodeKey[]): (string[] | undefined)[]
  getTree(navNodeId: string | NavNodeKey | NavNodeKey[]) {
    if (typeof navNodeId === 'string') {
      return this.navTree.data.get(navNodeId);
    }

    if (Array.isArray(navNodeId)) {
      return navNodeId.map(node => this.navTree.data.get(node.nodeId));
    }

    return this.navTree.data.get(navNodeId.nodeId);
  }

  async loadTree(navNodeId: string) {
    await this.navTree.load(navNodeId);
    return this.getTree(navNodeId)!;
  }

  removeTree(path = ROOT_NODE_PATH) {
    this.navTree.delete(path);
  }

  async refreshNode(navNodeId: string) {
    await this.navNodeInfoResource.refresh(navNodeId);
  }

  getNode(navNodeId: string): NavNode | undefined
  getNode(navNodeKey: NavNodeKey): NavNode | undefined
  getNode(navNodeKey: NavNodeKey[]): (NavNode | undefined)[]
  getNode(navNodeId: string | NavNodeKey | NavNodeKey[]) {
    if (typeof navNodeId === 'string') {
      return this.navNodeInfoResource.get(navNodeId);
    }

    if (Array.isArray(navNodeId)) {
      return navNodeId.map(node => this.navNodeInfoResource.get(node.nodeId));
    }

    return this.navNodeInfoResource.get(navNodeId.nodeId);
  }

  async loadNode(node: NavNodeKey): Promise<NavNode>
  async loadNode(...nodes: NavNodeKey[]): Promise<NavNode>
  async loadNode(...nodes: NavNodeKey[]) {
    const items = await this.navNodeInfoResource.load(resourceKeyList(nodes.map(n => n.nodeId)));

    for (let i = 0; i < items.length; i++) {
      items[i].parentId = nodes[i].parentId;
    }

    if (nodes.length === 1) {
      return this.getNode(nodes[0])!;
    }

    return this.getNode(nodes);
  }

  removeNode(navNodeId = ROOT_NODE_PATH) {
    this.navNodeInfoResource.delete(navNodeId);
  }

  getParent(node: NavNode) {
    return this.navNodeInfoResource.get(node.parentId);
  }

  isNodeHasData(node?: string | NavNode) {
    if (typeof node === 'string') {
      node = this.getNode(node);
    }

    if (!node || !node.objectFeatures) {
      return false;
    }

    return node.objectFeatures.includes(ENodeFeature.dataContainer)
      || node.objectFeatures.includes(ENodeFeature.container);
  }

  getNodeContainerInfo(nodeId: string): INodeContainerInfo {
    const initial: INodeContainerInfo = {};

    const scanParents = (res: INodeContainerInfo,
                         nodeId?: string): INodeContainerInfo => {
      if (!nodeId) {
        return res;
      }
      const object = this.getNode(nodeId);
      if (!object) {
        return res;
      }
      if (object.objectFeatures.includes(EObjectFeature.dataSource)) {
        res.connectionId = object.id;
      }
      if (object.objectFeatures.includes(EObjectFeature.catalog)) {
        res.catalogId = object.name; // note that catalogId is node name
      }
      if (object.objectFeatures.includes(EObjectFeature.schema)) {
        res.schemaId = object.name; // note that schemaId is node name
      }
      return scanParents(res, object.parentId);
    };

    return scanParents(initial, nodeId);
  }

  navigationNavNodeContext = async (
    contexts: IContextProvider<INodeNavigationData>,
    data: INodeNavigationData
  ): Promise<INodeNavigationContext> => {
    let nodeId = data.nodeId;
    let parentId = data.parentId;
    let folderId = '';
    let name: string | undefined;
    let icon: string | undefined;

    if (NodeManagerUtils.isDatabaseObject(nodeId) && data.type !== NavigationType.closeConnection) {
      const node = await this.loadNode({ nodeId, parentId });

      name = node.name;
      icon = node.icon;

      if (node.folder) {
        const parent = this.getNode(node.parentId);
        folderId = nodeId;
        if (parent && !parent.folder) {
          nodeId = parent.id;
          parentId = parent.parentId;
          name = parent.name;
          icon = parent.icon;
        }
      }

      if (data.folderId) {
        folderId = data.folderId;
      }
    }

    const getParents = () => {
      const parents: string[] = [];
      let parent = this.getNode(nodeId);

      while (parent && parent.parentId !== ROOT_NODE_PATH && parent.id !== parent.parentId) {
        parents.unshift(parent.parentId);
        parent = this.getNode(parent.parentId);
      }

      return parents;
    };

    const loadParents = async (parents: string[]) => {
      let parentId = ROOT_NODE_PATH;

      const nodes = await this.navNodeInfoResource.load(resourceKeyList(parents));

      for (const node of nodes) {
        node.parentId = parentId;
        parentId = node.id;
      }
    };

    return {
      type: data.type,
      nodeId,
      parentId,
      folderId,
      name,
      icon,
      getParents,
      loadParents,
    };
  }

  private async navigateHandler(contexts: IContextProvider<INodeNavigationData>) {
    const nodeInfo = await contexts.getContext(this.navigationNavNodeContext);

    if (NodeManagerUtils.isDatabaseObject(nodeInfo.nodeId)) {
      let connection: Connection | undefined;
      try {
        connection = await this.connectionAuthService.auth(
          NodeManagerUtils.connectionNodeIdToConnectionId(nodeInfo.nodeId)
        );
      } catch (exception) {
        this.notificationService.logException(exception);
        throw exception;
      }

      if (!connection?.connected) {
        throw new Error('Connection not established');
      }
    }
  }
}
