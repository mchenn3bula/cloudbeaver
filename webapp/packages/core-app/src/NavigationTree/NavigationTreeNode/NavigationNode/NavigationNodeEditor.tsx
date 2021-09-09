/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import { useCallback, useState } from 'react';

import { useService } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';

import { InlineEditor } from '../../../shared/InlineEditor/InlineEditor';
import type { NavNode } from '../../../shared/NodesManager/EntityTypes';
import { NavNodeManagerService } from '../../../shared/NodesManager/NavNodeManagerService';

interface Props {
  node: NavNode;
  onClose: () => void;
}

export const NavigationNodeEditor = observer<Props>(function NavigationNodeEditor({ node, onClose }) {
  const navNodeManagerService = useService(NavNodeManagerService);
  const notificationService = useService(NotificationService);

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(node.name || '');

  const save = useCallback(async () => {
    if (loading) {
      return;
    }

    try {
      if (node.name !== name) {
        setLoading(true);
        await navNodeManagerService.changeName(name, node);
      }
    } catch (exception) {
      notificationService.logException(exception, 'app_navigationTree_node_change_name_error');
    } finally {
      setLoading(false);
      onClose();
    }
  }, [name, onClose, node, loading, navNodeManagerService, notificationService]);

  return (
    <InlineEditor
      value={name}
      disabled={loading}
      simple
      autofocus
      onChange={setName}
      onSave={save}
      onReject={onClose}
      onBlur={onClose}
    />
  );
});
