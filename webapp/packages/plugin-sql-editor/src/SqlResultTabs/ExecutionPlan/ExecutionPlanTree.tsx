/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observable } from 'mobx';
import { useCallback, useContext, useState } from 'react';
import styled, { css } from 'reshadow';

import { Table, TableHeader, TableColumnHeader, TableBody } from '@cloudbeaver/core-blocks';
import { composes, useStyles } from '@cloudbeaver/core-theming';

import { ExecutionPlanTreeContext, IExecutionPlanNode } from './ExecutionPlanTreeContext';
import { NestedNode } from './NestedNode';

const styles = composes(
  css`
    TableHeader {
      composes: theme-background-surface from global;
    }
  `,
  css`
    TableHeader {
      position: sticky;
      top: 0;
      z-index: 1;
    }
  `
);

interface Props {
  className?: string;
}

export const ExecutionPlanTree: React.FC<Props> = function ExecutionPlanTree({ className }) {
  const treeContext = useContext(ExecutionPlanTreeContext);
  const [selectedNodes] = useState(() => observable(new Map()));

  if (!treeContext) {
    throw new Error('Tree context must be provided');
  }

  const selectNode = useCallback((node: IExecutionPlanNode) => {
    selectedNodes.clear();
    selectedNodes.set(node, true);

    treeContext.selectNode(node);
  }, [treeContext, selectedNodes]);

  return styled(useStyles(styles))(
    <Table className={className} selectedItems={selectedNodes} onSelect={selectNode}>
      <TableHeader>
        {treeContext.columns.map(property => (
          <TableColumnHeader key={property.id || property.order} title={property.displayName}>
            {property.displayName}
          </TableColumnHeader>
        ))}
      </TableHeader>
      <TableBody>
        {treeContext.nodes.map(node => (
          <NestedNode
            key={node.id}
            node={node}
            depth={0}
          />
        ))}
      </TableBody>
    </Table>
  );
};
