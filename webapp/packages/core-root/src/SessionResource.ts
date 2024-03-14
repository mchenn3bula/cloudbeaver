/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2024 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */
import { injectable } from '@cloudbeaver/core-di';
import { ISyncExecutor, SyncExecutor } from '@cloudbeaver/core-executor';
import { LocalizationService } from '@cloudbeaver/core-localization';
import { CachedDataResource } from '@cloudbeaver/core-resource';
import { GraphQLService, SessionStateFragment } from '@cloudbeaver/core-sdk';

import { ServerConfigResource } from './ServerConfigResource';
import { ServerEventId } from './SessionEventSource';
import { SessionInfoEventHandler } from './SessionInfoEventHandler';

export type SessionState = SessionStateFragment;
export interface ISessionAction {
  action: string;
  [key: string]: any;
}

interface SessionStateData {
  isValid?: boolean;
  remainingTime: number;
}

@injectable()
export class SessionResource extends CachedDataResource<SessionState | null> {
  private action: ISessionAction | null;
  readonly onStatusUpdate: ISyncExecutor<SessionStateData>;

  constructor(
    private readonly graphQLService: GraphQLService,
    sessionInfoEventHandler: SessionInfoEventHandler,
    serverConfigResource: ServerConfigResource,
    private readonly localizationService: LocalizationService,
  ) {
    super(() => null);

    this.onStatusUpdate = new SyncExecutor();
    sessionInfoEventHandler.onEvent(
      ServerEventId.CbSessionState,
      event => {
        if (this.data) {
          this.data.valid = event.isValid ?? this.data.valid;
          this.data.remainingTime = event.remainingTime;
          // TODO: probably we want to call here this.dataUpdate
        }
        this.onStatusUpdate.execute(event);
      },
      undefined,
      this,
    );

    this.action = null;
    this.sync(
      serverConfigResource,
      () => {},
      () => {},
    );
  }

  processAction(): ISessionAction | null {
    try {
      return this.action;
    } finally {
      this.action = null;
    }
  }

  async changeLanguage(locale: string): Promise<void> {
    if (this.data?.locale === locale) {
      return;
    }
    await this.graphQLService.sdk.changeSessionLanguage({ locale });

    if (this.data) {
      this.data.locale = locale;
    }

    this.markOutdated();
  }

  protected async loader(): Promise<SessionState> {
    const { session } = await this.graphQLService.sdk.openSession({ defaultLocale: this.localizationService.currentLanguage });

    return session;
  }

  async updateSession() {
    if (!this.data?.valid) {
      return;
    }

    const { updateSession } = await this.graphQLService.sdk.updateSession();

    this.setData(updateSession);

    return updateSession;
  }

  protected setData(data: SessionState | null) {
    if (!this.action) {
      this.action = data?.actionParameters;
    }

    super.setData(data);
  }
}
