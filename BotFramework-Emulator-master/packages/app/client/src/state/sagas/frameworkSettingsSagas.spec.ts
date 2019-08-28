//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
import { newNotification, SharedConstants } from '@bfemulator/app-shared';
import { applyMiddleware, combineReducers, createStore } from 'redux';
import sagaMiddlewareFactory from 'redux-saga';
import { call, put, select, takeEvery } from 'redux-saga/effects';
import { CommandServiceImpl, CommandServiceInstance } from '@bfemulator/sdk-shared';

import { CONTENT_TYPE_APP_SETTINGS, DOCUMENT_ID_APP_SETTINGS } from '../../constants';
import * as EditorActions from '../actions/editorActions';
import {
  FrameworkActionType,
  saveFrameworkSettings as saveFrameworkSettingsAction,
  setFrameworkSettings,
} from '../actions/frameworkSettingsActions';
import { beginAdd } from '../actions/notificationActions';
import { editor } from '../reducers/editor';
import { framework } from '../reducers/framework';

import { activeDocumentSelector, frameworkSettingsSagas, FrameworkSettingsSagas } from './frameworkSettingsSagas';

jest.mock('electron', () => ({
  ipcMain: new Proxy(
    {},
    {
      get(): any {
        return () => ({});
      },
      has() {
        return true;
      },
    }
  ),
  ipcRenderer: new Proxy(
    {},
    {
      get(): any {
        return () => ({});
      },
      has() {
        return true;
      },
    }
  ),
}));

const sagaMiddleWare = sagaMiddlewareFactory();
const mockStore = createStore(combineReducers({ framework, editor }), {}, applyMiddleware(sagaMiddleWare));
sagaMiddleWare.run(frameworkSettingsSagas);

jest.mock('../store', () => ({
  get store() {
    return mockStore;
  },
}));

mockStore.dispatch(
  EditorActions.open({
    contentType: CONTENT_TYPE_APP_SETTINGS,
    documentId: DOCUMENT_ID_APP_SETTINGS,
    isGlobal: true,
    meta: null,
  })
);
describe('The frameworkSettingsSagas', () => {
  let commandService: CommandServiceImpl;
  beforeAll(() => {
    const decorator = CommandServiceInstance();
    const descriptor = decorator({ descriptor: {} }, 'none') as any;
    commandService = descriptor.descriptor.get();
  });

  it('should register the expected generators', () => {
    const it = frameworkSettingsSagas();
    expect(it.next().value).toEqual(
      takeEvery(FrameworkActionType.SAVE_FRAMEWORK_SETTINGS, FrameworkSettingsSagas.saveFrameworkSettings)
    );
  });

  it('should save the framework settings', async () => {
    const it = FrameworkSettingsSagas.saveFrameworkSettings(saveFrameworkSettingsAction({}));
    // selector to get the active document from the state
    const selector = it.next().value;
    expect(selector).toEqual(select(activeDocumentSelector));
    const value = selector.SELECT.selector(mockStore.getState());
    // put the dirty state to false
    expect(it.next(value).value).toEqual(put(EditorActions.setDirtyFlag(value.documentId, false)));
    expect(it.next().value).toEqual(put(setFrameworkSettings({})));
    expect(it.next().done).toBe(true);
  });

  it('should send a notification when saving the settings fails', () => {
    const it = FrameworkSettingsSagas.saveFrameworkSettings(saveFrameworkSettingsAction({}));
    it.next();
    const errMsg = `Error while saving emulator settings: oh noes!`;
    const notification = newNotification(errMsg);
    notification.timestamp = jasmine.any(Number) as any;
    notification.id = jasmine.any(String) as any;
    expect(it.throw('oh noes!').value).toEqual(put(beginAdd(notification)));
  });
});
